import assert from "node:assert/strict";
import test from "node:test";
import { CausalDecoder, type Batch } from "../dist/model/trainable/decoder.js";
import { maskedCrossEntropy } from "../dist/training/loss.js";
import { PAD, BOS, EOS, BYTE_VOCABULARY_SIZE as V } from "../dist/model/trainable/tokenizer.js";

const config = { context: 8, width: 4, blocks: 2, heads: 2, feedForward: 8, seed: 11 };
const batch = (inputs: number[], targets: number[], mask = targets.map((id) => id === PAD ? 0 : 1), batchSize = 1): Batch => ({ inputs: Int32Array.from(inputs), targets: Int32Array.from(targets), targetMask: Uint8Array.from(mask), batchSize, sequenceLength: inputs.length / batchSize });
const small = batch([BOS, 65, 66], [65, 66, EOS]);
function close(actual: number, expected: number, tolerance = 1e-10): void { assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} vs ${expected}`); }

test("causal decoder is deterministic, position-sensitive, and cannot see suffix tokens", () => {
  const model = new CausalDecoder(config);
  const first = model.forward(small, false).logits;
  assert.equal(first.length, 3 * V);
  assert.deepEqual(first, new CausalDecoder(config).forward(small, false).logits);
  const altered = model.forward(batch([BOS, 65, 90], [65, 90, EOS]), false).logits;
  for (let i = 0; i < 2 * V; i++) close(first[i]!, altered[i]!);
  assert.notDeepEqual(first.subarray(2 * V), altered.subarray(2 * V));
});

test("batched sequences are isolated and PAD targets contribute zero gradients", () => {
  const model = new CausalDecoder(config);
  const padded = batch([BOS, 65, PAD, BOS, 66, 67], [65, EOS, PAD, 66, 67, EOS], undefined, 2);
  const combined = model.forward(padded);
  const single = model.forward(batch([BOS, 65], [65, EOS]), false);
  for (let i = 0; i < single.logits.length; i++) close(combined.logits[i]!, single.logits[i]!);
  const second = model.forward(batch([BOS, 66, 67], [66, 67, EOS]), false);
  for (let i = 0; i < second.logits.length; i++) close(combined.logits[3 * V + i]!, second.logits[i]!);
  const loss = maskedCrossEntropy(combined.logits, padded.targets, padded.targetMask, V);
  assert.equal(loss.validTokens, 5);
  assert.ok(loss.gradient.subarray(2 * V, 3 * V).every((value) => value === 0));
  model.backward(combined.cache, loss.gradient);
  const tokens = model.parameters().find((p) => p.name === "token")!;
  assert.ok(tokens.gradients.subarray(PAD * config.width, (PAD + 1) * config.width).every((value) => value === 0));
});

test("loss matches analytical probabilities and all logit finite differences", () => {
  const logits = Float64Array.from([1000, 1001, 999, -4, 3, 9]);
  const targets = Int32Array.from([1, 0]), mask = Uint8Array.from([1, 0]);
  const result = maskedCrossEntropy(logits, targets, mask, 3);
  close(result.loss, Math.log(1 + Math.exp(-1) + Math.exp(-2)));
  for (let i = 0; i < logits.length; i++) {
    const before = logits[i]!;
    logits[i] = before + 1e-5; const plus = maskedCrossEntropy(logits, targets, mask, 3).loss;
    logits[i] = before - 1e-5; const minus = maskedCrossEntropy(logits, targets, mask, 3).loss;
    logits[i] = before;
    close(result.gradient[i]!, (plus - minus) / 2e-5, 1e-6);
  }
  assert.throws(() => maskedCrossEntropy(logits, targets, new Uint8Array(2), 3));
  assert.equal(maskedCrossEntropy(Float64Array.from([0, -1000]), Int32Array.from([1]), Uint8Array.from([1]), 2).perplexity, null);
});

test("full model gradients match finite differences for every parameter tensor", () => {
  const model = new CausalDecoder(config);
  const forward = model.forward(small);
  model.backward(forward.cache, maskedCrossEntropy(forward.logits, small.targets, small.targetMask, V).gradient);
  const evaluate = () => maskedCrossEntropy(model.forward(small, false).logits, small.targets, small.targetMask, V).loss;
  for (const parameter of model.parameters()) {
    let strongest = 0;
    for (let i = 1; i < parameter.gradients.length; i++) if (Math.abs(parameter.gradients[i]!) > Math.abs(parameter.gradients[strongest]!)) strongest = i;
    for (const i of new Set([0, strongest, Math.floor(parameter.values.length / 2), parameter.values.length - 1])) {
      const before = parameter.values[i]!, actual = parameter.gradients[i]!;
      parameter.values[i] = before + 1e-5; const plus = evaluate();
      parameter.values[i] = before - 1e-5; const minus = evaluate();
      parameter.values[i] = before;
      const numeric = (plus - minus) / 2e-5, error = Math.abs(actual - numeric);
      assert.ok(error <= 1e-6 || error / Math.max(1e-12, Math.abs(actual), Math.abs(numeric)) <= 1e-4, `${parameter.name}[${i}] analytical=${actual} numerical=${numeric}`);
    }
  }
  for (const name of ["block.0.q.weight", "block.0.v.weight", "block.1.ff1.weight", "vocabulary.weight"]) {
    assert.ok(model.parameters().find((p) => p.name === name)!.gradients.some((g) => Math.abs(g) > 1e-8));
  }
});

test("evaluation is read-only and backward caches are owned and single-use", () => {
  const model = new CausalDecoder(config);
  const before = model.parameters().map((p) => ({ values: p.values.slice(), gradients: p.gradients.slice() }));
  assert.equal(model.forward(small, false).cache, null);
  model.parameters().forEach((p, i) => { assert.deepEqual(p.values, before[i]!.values); assert.deepEqual(p.gradients, before[i]!.gradients); });
  const result = model.forward(small), g = maskedCrossEntropy(result.logits, small.targets, small.targetMask, V).gradient;
  assert.throws(() => new CausalDecoder(config).backward(result.cache, g));
  model.backward(result.cache, g);
  assert.throws(() => model.backward(result.cache, g));
  assert.throws(() => model.backward(null, g));
});

test("one-token batches work and invalid padding/configuration is rejected", () => {
  const model = new CausalDecoder(config);
  const one = batch([BOS], [EOS]), result = model.forward(one);
  model.backward(result.cache, maskedCrossEntropy(result.logits, one.targets, one.targetMask, V).gradient);
  assert.ok(model.parameters().every((p) => p.gradients.every(Number.isFinite)));
  assert.throws(() => model.forward(batch([PAD], [PAD])));
  assert.throws(() => model.forward(batch([BOS, PAD, 65], [65, PAD, EOS])));
  assert.throws(() => model.forward(batch([BOS, PAD], [65, EOS])));
  assert.throws(() => new CausalDecoder({ ...config, heads: 3 }));
});

test("batched backward equals weighted independent sequence gradients", () => {
  const model = new CausalDecoder(config);
  const combined = batch([BOS, 65, PAD, BOS, 66, 67], [65, EOS, PAD, 66, 67, EOS], undefined, 2);
  const output = model.forward(combined);
  model.backward(output.cache, maskedCrossEntropy(output.logits, combined.targets, combined.targetMask, V).gradient);
  const reference = new CausalDecoder(config);
  for (const single of [batch([BOS, 65], [65, EOS]), batch([BOS, 66, 67], [66, 67, EOS])]) {
    const result = reference.forward(single), loss = maskedCrossEntropy(result.logits, single.targets, single.targetMask, V);
    reference.backward(result.cache, loss.gradient.map((g) => g * single.inputs.length / 5));
  }
  model.parameters().forEach((p, i) => p.gradients.forEach((g, j) => close(g, reference.parameters()[i]!.gradients[j]!)));
});

test("default architecture emits finite byte-vocabulary logits", () => {
  const model = new CausalDecoder();
  const output = model.forward(small, false);
  assert.equal(model.config.width, 32);
  assert.equal(model.config.blocks, 2);
  assert.equal(model.config.heads, 4);
  assert.equal(output.logits.length, small.inputs.length * V);
  assert.ok(output.logits.every(Number.isFinite));
  assert.equal(model.registry.count, model.parameters().reduce((total, parameter) => total + parameter.values.length, 0));
});
