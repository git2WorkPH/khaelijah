import assert from "node:assert/strict";
import test from "node:test";
import { ByteTokenizer, BOS, EOS, PAD } from "../dist/model/trainable/tokenizer.js";
import { ParameterRegistry, SeededRandom } from "../dist/model/trainable/parameters.js";
import { Matrix, add, addBias, embedding, layerNorm, maskedSoftmax, matmul, relu, scale, transpose, type Kernel } from "../dist/model/trainable/operations.js";

function matrix(rows: number, cols: number, values?: number[]): Matrix {
  return new Matrix(rows, cols, values ?? Array.from({ length: rows * cols }, (_, i) => Math.sin(i + 1) * 0.7));
}

/** Differentiate a scalar weighted sum of outputs to test the entire Jacobian-vector product. */
function gradientCheck(inputs: Matrix[], operation: (...inputs: Matrix[]) => Kernel): void {
  const forward = operation(...inputs);
  const upstream = matrix(forward.output.rows, forward.output.cols);
  const analytic = forward.backward(upstream);
  assert.equal(analytic.length, inputs.length);
  const objective = () => operation(...inputs).output.data.reduce((sum, value, i) => sum + value * upstream.data[i]!, 0);
  for (let input = 0; input < inputs.length; input++) {
    const values = inputs[input]!.data;
    for (let index = 0; index < values.length; index++) {
      const original = values[index]!;
      values[index] = original + 1e-5; const plus = objective();
      values[index] = original - 1e-5; const minus = objective();
      values[index] = original;
      const numeric = (plus - minus) / 2e-5, actual = analytic[input]!.data[index]!;
      const absolute = Math.abs(numeric - actual);
      const relative = absolute / Math.max(1e-12, Math.abs(numeric), Math.abs(actual));
      assert.ok(absolute <= 1e-6 || relative <= 1e-4, `input ${input} index ${index}: analytical=${actual}, numeric=${numeric}`);
    }
  }
}

test("byte tokenizer preserves Unicode, case, whitespace, and BOM", () => {
  const tokenizer = new ByteTokenizer();
  for (const text of ["", "HELLO world\n\t", "é 中 🦀", "\uFEFFprefix", "\0end"]) {
    assert.equal(tokenizer.decode(tokenizer.encode(text)), text);
    const bounded = tokenizer.encode(text, true);
    assert.equal(bounded[0], BOS); assert.equal(bounded.at(-1), EOS);
    assert.equal(tokenizer.decode(bounded), text);
  }
  assert.equal(tokenizer.decode([PAD, BOS, EOS]), "");
  assert.equal(tokenizer.decode([0xff]), "�");
  for (const invalid of [-1, 259, 0.1, NaN]) assert.throws(() => tokenizer.decode([invalid]));
});

test("parameter initialization and PRNG resume are deterministic", () => {
  const random = new SeededRandom(11), registry = new ParameterRegistry(random);
  const weight = registry.create("w", [2, 3]);
  const same = new ParameterRegistry(new SeededRandom(11)).create("w", [2, 3]);
  assert.deepEqual(weight.values, same.values);
  assert.ok(weight.values.some((value) => value !== 0));
  const state = random.state, next = random.next();
  random.restore(state); assert.equal(random.next(), next);
  assert.deepEqual(registry.create("bias", [3], "zero").values, new Float64Array(3));
  assert.deepEqual(registry.create("gain", [3], "one").values, new Float64Array(3).fill(1));
  assert.equal(registry.count, 12);
  registry.accumulate("w", new Float64Array(6).fill(2));
  registry.accumulate("w", new Float64Array(6).fill(3));
  assert.deepEqual(weight.gradients, new Float64Array(6).fill(5));
  const before = weight.values.slice(); registry.zeroGrad();
  assert.deepEqual(weight.gradients, new Float64Array(6)); assert.deepEqual(weight.values, before);
  assert.throws(() => registry.create("w", [1]));
  assert.throws(() => registry.create("bad", [0]));
  assert.throws(() => registry.accumulate("w", new Float64Array([NaN])));
  assert.throws(() => random.restore(-1));
});

test("matmul forward and all operand gradients", () => {
  assert.deepEqual([...matmul(matrix(1, 2, [2, 3]), matrix(2, 1, [4, 5])).output.data], [23]);
  gradientCheck([matrix(2, 3), matrix(3, 4)], matmul);
});
test("residual addition gradients", () => gradientCheck([matrix(2, 3), matrix(2, 3)], add));
test("bias gradients sum across rows", () => gradientCheck([matrix(3, 2), matrix(1, 2)], addBias));
test("transpose gradients", () => gradientCheck([matrix(2, 3)], transpose));
test("scaling gradients", () => gradientCheck([matrix(2, 3)], (x) => scale(x, 0.31)));
test("ReLU gradients away from kinks", () => gradientCheck([matrix(2, 3)], relu));
test("embedding gradients accumulate repeated IDs", () => gradientCheck([matrix(4, 3)], (table) => embedding(table, [2, 0, 2])));
test("layer norm input, gain and bias gradients", () => gradientCheck([matrix(2, 3), matrix(1, 3), matrix(1, 3)], layerNorm));
test("softmax gradients with causal mask", () => gradientCheck([matrix(3, 3)], (x) => maskedSoftmax(x, Uint8Array.from([1, 0, 0, 1, 1, 0, 1, 1, 1]))));
test("unmasked softmax gradients", () => gradientCheck([matrix(2, 3)], maskedSoftmax));

test("softmax handles large logits and masks with exactly zero gradients", () => {
  const op = maskedSoftmax(matrix(1, 3, [1000, 1001, 99999]), Uint8Array.from([1, 1, 0]));
  assert.ok(Math.abs(op.output.data[0]! - 1 / (1 + Math.E)) < 1e-12);
  assert.equal(op.output.data[2], 0);
  assert.equal(op.backward(matrix(1, 3))[0]!.data[2], 0);
  assert.throws(() => maskedSoftmax(matrix(1, 2), new Uint8Array(2)));
});

test("kernel caches preserve forward inputs and backward does not accumulate", () => {
  const a = matrix(2, 2), b = matrix(2, 2), op = matmul(a, b), g = matrix(2, 2);
  const expected = op.backward(g);
  a.data.fill(99); b.data.fill(99);
  assert.deepEqual(op.backward(g), expected);
  assert.deepEqual(op.backward(g), expected);
});

test("single-width normalization and malformed inputs", () => {
  const op = layerNorm(matrix(1, 1, [7]), matrix(1, 1, [2]), matrix(1, 1, [3]));
  assert.equal(op.output.data[0], 3);
  assert.deepEqual([...op.backward(matrix(1, 1, [1]))[0]!.data], [0]);
  assert.throws(() => new Matrix(0, 2));
  assert.throws(() => new Matrix(1, 1, [Infinity]));
  assert.throws(() => matmul(matrix(1, 2), matrix(1, 2)));
  assert.throws(() => embedding(matrix(2, 2), [2]));
  assert.throws(() => relu(matrix(1, 2)).backward(matrix(1, 1)));
});
