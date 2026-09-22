import assert from "node:assert/strict";
import test from "node:test";
import { loadDataset, validateDataset, batches, digest } from "../dist/training/dataset.js";
import { AdamW, DEFAULT_ADAM } from "../dist/training/optimizer.js";
import { CausalDecoder } from "../dist/model/trainable/decoder.js";
import { ParameterRegistry, SeededRandom } from "../dist/model/trainable/parameters.js";
import { evaluateLoss, train } from "../dist/training/trainer.js";
import { PAD, BOS, EOS } from "../dist/model/trainable/tokenizer.js";
const dataset = () => loadDataset(new URL("../datasets/synthetic-pattern-v1.json", import.meta.url));
const model = () => new CausalDecoder({ context: 16, width: 8, heads: 2, blocks: 1, feedForward: 16, seed: 11 });

test("manifest rejects corrupted hashes, missing provenance and cross-split duplicates", () => {
  const corrupted = dataset(); corrupted.documents[0]!.text += "x";
  assert.throws(() => validateDataset(corrupted), /hash/);
  const missing = dataset(); missing.documents[0]!.license = "";
  assert.throws(() => validateDataset(missing), /metadata/);
  const duplicate = dataset(); duplicate.documents[1]!.text = duplicate.documents[0]!.text;
  duplicate.documents[1]!.sha256 = digest(duplicate.documents[1]!.text);
  assert.throws(() => validateDataset(duplicate), /Cross-split/);
});
test("batching shifts targets, preserves split isolation, and masks partial windows", () => {
  const data = dataset();
  const text = "AB"; data.documents = [{ ...data.documents[0]!, text, sha256: digest(text) }];
  const result = batches(data, "train", 4, 4);
  assert.deepEqual([...result[0]!.inputs], [BOS, 65, 66, PAD]);
  assert.deepEqual([...result[0]!.targets], [65, 66, EOS, PAD]);
  assert.deepEqual([...result[0]!.targetMask], [1, 1, 1, 0]);
  assert.deepEqual(batches(data, "validation", 4, 4), []);
  assert.deepEqual(result, batches(data, "train", 4, 4));
});
test("AdamW first update matches hand calculation and excludes biases from decay", () => {
  const registry = new ParameterRegistry(new SeededRandom(1));
  const weight = registry.create("layer.weight", [1, 1], "one"), bias = registry.create("layer.bias", [1, 1], "one");
  weight.gradients[0] = 2; bias.gradients[0] = 2;
  const optimizer = new AdamW(registry.parameters(), { ...DEFAULT_ADAM, learningRate: 0.1, weightDecay: 0.1, clipNorm: 10 });
  optimizer.update();
  assert.ok(Math.abs(weight.values[0]! - (0.99 - 0.1 * 2 / (2 + 1e-8))) < 1e-12);
  assert.ok(Math.abs(bias.values[0]! - (1 - 0.1 * 2 / (2 + 1e-8))) < 1e-12);
  const before = weight.values.slice(), moments = optimizer.moments[0]!.first.slice();
  bias.gradients[0] = NaN;
  assert.throws(() => optimizer.update()); assert.equal(optimizer.step, 1);
  assert.deepEqual(weight.values, before); assert.deepEqual(optimizer.moments[0]!.first, moments);
});
test("global norm clipping limits moment inputs", () => {
  const registry = new ParameterRegistry(new SeededRandom(1)), p = registry.create("w", [1, 2]);
  p.gradients.set([3, 4]); const optimizer = new AdamW(registry.parameters());
  assert.equal(optimizer.update(), 5);
  assert.ok(Math.abs(optimizer.moments[0]!.first[0]! - 0.06) < 1e-12);
  assert.ok(Math.abs(optimizer.moments[0]!.first[1]! - 0.08) < 1e-12);
});
test("resource and cancellation limits stop before an update", async () => {
  const m = model(), data = batches(dataset(), "train", 16, 4), optimizer = new AdamW(m.parameters());
  const limits = { maxSteps: 2, maxMilliseconds: 10, maxRssBytes: 100 };
  assert.equal((await train(m, data, optimizer, limits, { now: () => 0, rss: () => 100 })).stopReason, "memory_limit");
  let now = 0;
  assert.equal((await train(m, data, optimizer, limits, { now: () => now += 10, rss: () => 0 })).stopReason, "time_limit");
  const controller = new AbortController(); controller.abort();
  assert.equal((await train(m, data, optimizer, { ...limits, signal: controller.signal })).stopReason, "cancelled");
  assert.equal(optimizer.step, 0);
});
test("small model learns while no-update evaluation is unchanged", async () => {
  const m = model(), data = batches(dataset(), "train", 16, 4);
  const initial = evaluateLoss(m, data); assert.equal(evaluateLoss(m, data), initial);
  const result = await train(m, data, new AdamW(m.parameters()), { maxSteps: 100, maxMilliseconds: 60000, maxRssBytes: 1024 ** 3 });
  assert.equal(result.stopReason, "max_steps"); assert.equal(result.completedSteps, 100);
  assert.ok(evaluateLoss(m, data) < initial * 0.5);
});
