import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { mkdtemp, readFile, readdir, rm, writeFile, truncate } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CausalDecoder } from "../dist/model/trainable/decoder.js";
import { generate } from "../dist/model/trainable/generation.js";
import { SeededRandom } from "../dist/model/trainable/parameters.js";
import { EOS, PAD, BOS } from "../dist/model/trainable/tokenizer.js";
import { loadDataset, batches } from "../dist/training/dataset.js";
import { AdamW } from "../dist/training/optimizer.js";
import { train, evaluateLoss } from "../dist/training/trainer.js";
import { captureCheckpoint, restoreCheckpoint, saveCheckpoint, loadCheckpoint, encodeCheckpoint, decodeCheckpoint, dataIdentity, MAX_CHECKPOINT_BYTES } from "../dist/training/checkpoint.js";

const config = { context: 8, width: 8, heads: 2, blocks: 1, feedForward: 16, seed: 11 };
const dataset = loadDataset(new URL("../datasets/synthetic-pattern-v1.json", import.meta.url));
const identity = dataIdentity(dataset, 8, 2);
const training = batches(dataset, "train", 8, 2);
const limits = { maxSteps: 5, maxMilliseconds: 60000, maxRssBytes: 1024 ** 3 };
function setup() { const model = new CausalDecoder(config); return { model, optimizer: new AdamW(model.parameters()) }; }
async function temporary(t: TestContext) {
  const dir = await mkdtemp(join(tmpdir(), "jc-checkpoint-"));
  t.after(() => rm(dir, { recursive: true, force: true })); return dir;
}

test("multi-batch ten steps equal five plus disk checkpoint plus five exactly", async (t) => {
  const dir = await temporary(t), continuous = setup(), split = setup();
  assert.ok(training.length > 1);
  assert.notEqual(5 % training.length, 0); // A loader incorrectly resetting the cursor must diverge.
  await train(continuous.model, training, continuous.optimizer, { ...limits, maxSteps: 10 });
  const first = await train(split.model, training, split.optimizer, limits);
  const snapshot = captureCheckpoint(split.model, { optimizer: split.optimizer, data: identity, metrics: first.metrics, samplerState: 42 });
  await saveCheckpoint(join(dir, "state.json"), snapshot);
  const loaded = await loadCheckpoint(join(dir, "state.json"));
  const resumed = restoreCheckpoint(loaded, identity);
  assert.equal(resumed.sampler.state, 42);
  assert.equal(resumed.optimizer!.step, 5);
  const second = await train(resumed.model, training, resumed.optimizer!, limits);
  assert.equal(second.completedSteps, 5); assert.equal(resumed.optimizer!.step, 10);
  assert.deepEqual(resumed.model.parameters().map((p) => p.values), continuous.model.parameters().map((p) => p.values));
  assert.deepEqual(resumed.optimizer!.moments, continuous.optimizer.moments);
  assert.equal(resumed.model.registry.random.state, continuous.model.registry.random.state);
  assert.deepEqual(generate(split.model, "abc", { maxNewTokens: 12 }), generate(restoreCheckpoint(loaded).model, "abc", { maxNewTokens: 12 }));
});

test("checkpoint rejects corrupt schema, numeric state, cursor, runtime and dataset mismatch", () => {
  const { model, optimizer } = setup();
  const good = captureCheckpoint(model, { optimizer, data: identity });
  const mutate = (fn: (c: any) => void) => { const bad = structuredClone(good); fn(bad); assert.throws(() => restoreCheckpoint(bad, identity)); };
  mutate((c) => c.format = "future"); mutate((c) => c.tokenizer = "hashed");
  mutate((c) => c.parameters.pop()); mutate((c) => c.parameters.push(c.parameters[0]));
  mutate((c) => c.parameters[1].name = c.parameters[0].name);
  mutate((c) => c.parameters[0].shape[0]++); mutate((c) => c.parameters[0].values[0] = Infinity);
  mutate((c) => delete c.parameters[0].values[0]);
  mutate((c) => c.training.moments[0].second[0] = -1);
  mutate((c) => c.training.moments[0].first[0] = NaN);
  mutate((c) => c.training.options.learningRate = undefined);
  mutate((c) => c.training.step = 0.5); mutate((c) => c.training.nextBatch = 1);
  mutate((c) => c.randomState = -1); mutate((c) => c.samplerState = 2 ** 32);
  mutate((c) => c.training.data.manifestHash = "a".repeat(64));
  mutate((c) => c.training.data.batchHash = "b".repeat(64));
  mutate((c) => c.runtime = "v0.0.1");
  mutate((c) => c.config.width = 256);
  mutate((c) => c.training.metrics = [{ step: 1, loss: 1, gradientNorm: 1 }]);
  assert.throws(() => restoreCheckpoint(good, { ...identity, batchSize: 1 }));
  const weights = captureCheckpoint(model);
  assert.equal(restoreCheckpoint(weights).optimizer, undefined);
  assert.throws(() => restoreCheckpoint(weights, identity));
  const text = encodeCheckpoint(good), envelope = JSON.parse(text);
  envelope.payload.parameters[0].values[0] += 1;
  assert.throws(() => decodeCheckpoint(JSON.stringify(envelope)), /checksum/);
  assert.throws(() => decodeCheckpoint(text.slice(0, -3)));
  assert.deepEqual(decodeCheckpoint(text), good);
  assert.deepEqual(captureCheckpoint(model, { optimizer, data: identity }), good);
});

test("atomic failures preserve previous checkpoint and remove only owned temporary files", async (t) => {
  const dir = await temporary(t), path = join(dir, "state.json"), { model } = setup();
  const good = captureCheckpoint(model); await saveCheckpoint(path, good);
  const before = await readFile(path, "utf8");
  for (const hook of ["beforeWrite", "beforeRename"] as const) {
    await assert.rejects(saveCheckpoint(path, good, { [hook]: () => { throw new Error("injected I/O failure"); } }), /injected/);
    assert.equal(await readFile(path, "utf8"), before);
    assert.deepEqual(await readdir(dir), ["state.json"]);
  }
  const bad = structuredClone(good); bad.parameters[0]!.values[0] = NaN;
  await assert.rejects(saveCheckpoint(path, bad)); assert.equal(await readFile(path, "utf8"), before);
  await writeFile(join(dir, "huge.json"), ""); await truncate(join(dir, "huge.json"), MAX_CHECKPOINT_BYTES + 1);
  await assert.rejects(loadCheckpoint(join(dir, "huge.json")), /Oversized/);
});

test("complete-step hooks save cancellation/time/memory stops; failed updates publish nothing", async (t) => {
  const dir = await temporary(t);
  for (const stop of ["cancelled", "time_limit", "memory_limit"] as const) {
    const { model, optimizer } = setup(), controller = new AbortController();
    const boundarySteps: number[] = [];
    const result = await train(model, training, optimizer, { ...limits, signal: controller.signal,
      onBoundary: async (state) => {
        boundarySteps.push(state.step);
        await saveCheckpoint(join(dir, stop), captureCheckpoint(model, { optimizer, data: identity, metrics: state.metrics }));
        if (stop === "cancelled") controller.abort();
      },
    }, { now: () => stop === "time_limit" && optimizer.step > 0 ? 60000 : 0, rss: () => stop === "memory_limit" && optimizer.step > 0 ? 1024 ** 3 : 0 });
    assert.equal(result.stopReason, stop); assert.equal(result.completedSteps, 1);
    assert.deepEqual(boundarySteps, [1, 1]);
    assert.equal((await loadCheckpoint(join(dir, stop))).training!.step, 1);
  }
  const { model, optimizer } = setup(); let calls = 0;
  model.parameters()[0]!.values[0] = NaN;
  await assert.rejects(train(model, training, optimizer, { ...limits, onBoundary: () => { calls++; } }));
  assert.equal(calls, 0);
});

test("generation and held-out evaluation are read-only, sampling restores, bounds and EOS apply", () => {
  const { model, optimizer } = setup();
  model.parameters()[0]!.gradients.fill(0.5);
  const before = captureCheckpoint(model, { optimizer, data: identity });
  const gradients = model.parameters().map((p) => p.gradients.slice());
  const result = generate(model, "long prompt ".repeat(10), { maxNewTokens: 9 });
  assert.ok(result.tokens.length <= 9); assert.ok(result.tokens.every((id) => id !== PAD && id !== BOS && id !== EOS));
  assert.deepEqual(result, generate(model, "long prompt ".repeat(10), { maxNewTokens: 9 }));
  evaluateLoss(model, batches(dataset, "validation", 8, 1));
  assert.deepEqual(captureCheckpoint(model, { optimizer, data: identity }), before);
  assert.deepEqual(model.parameters().map((p) => p.gradients), gradients);
  assert.deepEqual(generate(model, "abc", { temperature: 0.8, topK: 5, random: new SeededRandom(17) }), generate(restoreCheckpoint(before).model, "abc", { temperature: 0.8, topK: 5, random: new SeededRandom(17) }));
  const random = new SeededRandom(17);
  generate(model, "abc", { temperature: 0.8, random, maxNewTokens: 2 });
  const sampled = restoreCheckpoint(captureCheckpoint(model, { optimizer, data: identity, samplerState: random.state }));
  assert.deepEqual(generate(model, "abc", { temperature: 0.8, random }), generate(sampled.model, "abc", { temperature: 0.8, random: sampled.sampler }));
  for (const options of [{ maxNewTokens: 0 }, { maxNewTokens: 257 }, { temperature: -1 }, { temperature: Infinity }, { temperature: 1 }, { topK: 0 }, { topK: 258 }]) assert.throws(() => generate(model, "a", options));
  assert.throws(() => generate(model, "x".repeat(65537)));
  for (const p of model.parameters()) p.values.fill(0);
  model.parameters().find((p) => p.name === "vocabulary.bias")!.values[EOS] = 100;
  assert.deepEqual(generate(model, ""), { text: "", tokens: [], stopReason: "eos" });
  model.parameters().find((p) => p.name === "vocabulary.bias")!.values[65] = 200;
  assert.equal(generate(model, "", { maxNewTokens: 3 }).text, "AAA");
});
