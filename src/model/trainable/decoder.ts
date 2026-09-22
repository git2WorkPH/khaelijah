import { Matrix, type Kernel, add, addBias, embedding, layerNorm, maskedSoftmax, matmul, relu, scale, transpose } from "./operations.js";
import { ParameterRegistry, SeededRandom, type Parameter } from "./parameters.js";
import { BYTE_VOCABULARY_SIZE, PAD } from "./tokenizer.js";

export interface DecoderConfig {
  readonly context: number;
  readonly width: number;
  readonly blocks: number;
  readonly heads: number;
  readonly feedForward: number;
  readonly seed: number;
}
export const DEFAULT_DECODER_CONFIG: DecoderConfig = Object.freeze({ context: 64, width: 32, blocks: 2, heads: 4, feedForward: 128, seed: 11 });
export interface Batch {
  readonly inputs: Int32Array;
  readonly targets: Int32Array;
  readonly targetMask: Uint8Array;
  readonly batchSize: number;
  readonly sequenceLength: number;
}

interface Node { value: Matrix; gradient: Matrix; parents: readonly Node[]; backward?: Kernel["backward"]; parameter?: Parameter; }
class Tape {
  readonly nodes: Node[] = [];
  leaf(value: Matrix, parameter?: Parameter): Node {
    const node: Node = { value, gradient: new Matrix(value.rows, value.cols), parents: [], ...(parameter ? { parameter } : {}) };
    this.nodes.push(node); return node;
  }
  op(operation: Kernel, ...parents: Node[]): Node {
    const node: Node = { value: operation.output, gradient: new Matrix(operation.output.rows, operation.output.cols), parents, backward: operation.backward };
    this.nodes.push(node); return node;
  }
  backward(output: Node, gradient: Float64Array): void {
    output.gradient.data.set(gradient);
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const node = this.nodes[i]!;
      const derivatives = node.backward?.(node.gradient);
      node.parents.forEach((parent, j) => {
        const local = derivatives![j]!;
        for (let k = 0; k < local.data.length; k++) parent.gradient.data[k] = parent.gradient.data[k]! + local.data[k]!;
      });
    }
  }
}

/** Select arbitrary entries; backward scatter-adds, so slices/heads retain shared derivatives. */
function gather(input: Matrix, rows: number, cols: number, indices: readonly number[]): Kernel {
  return { output: new Matrix(rows, cols, indices.map((i) => input.data[i]!)), backward(g) {
    const dx = new Matrix(input.rows, input.cols);
    indices.forEach((index, i) => { dx.data[index] = dx.data[index]! + g.data[i]!; });
    return [dx];
  } };
}
function concatenate(inputs: readonly Matrix[], axis: "rows" | "cols"): Kernel {
  const rows = axis === "rows" ? inputs.reduce((n, x) => n + x.rows, 0) : inputs[0]!.rows;
  const cols = axis === "cols" ? inputs.reduce((n, x) => n + x.cols, 0) : inputs[0]!.cols;
  const output = new Matrix(rows, cols);
  const maps: number[][] = [];
  let offset = 0;
  for (const input of inputs) {
    const indices: number[] = [];
    for (let r = 0; r < input.rows; r++) for (let c = 0; c < input.cols; c++) {
      const index = axis === "rows" ? (offset + r) * cols + c : r * cols + offset + c;
      output.data[index] = input.data[r * input.cols + c]!; indices.push(index);
    }
    maps.push(indices); offset += axis === "rows" ? input.rows : input.cols;
  }
  return { output, backward(g) { return inputs.map((input, i) => new Matrix(input.rows, input.cols, maps[i]!.map((index) => g.data[index]!))); } };
}

interface Cache { tape: Tape; output: Node; }
export class CausalDecoder {
  readonly config: DecoderConfig;
  readonly registry: ParameterRegistry;
  private readonly cache = new WeakMap<object, Cache>();
  constructor(config: DecoderConfig = DEFAULT_DECODER_CONFIG) {
    for (const value of [config.context, config.width, config.blocks, config.heads, config.feedForward]) {
      if (!Number.isSafeInteger(value) || value < 1) throw new Error("Invalid decoder configuration.");
    }
    if (config.width % config.heads !== 0 || config.context > 256 || config.width > 256 || config.blocks > 8 || config.feedForward > 1024) throw new Error("Unsupported decoder dimensions.");
    this.config = Object.freeze({ ...config });
    this.registry = new ParameterRegistry(new SeededRandom(config.seed));
    const weight = (name: string, rows: number, cols: number) => this.registry.create(name, [rows, cols]);
    const norm = (name: string) => { this.registry.create(`${name}.gain`, [1, config.width], "one"); this.registry.create(`${name}.bias`, [1, config.width], "zero"); };
    const linear = (name: string, input: number, output: number) => { weight(`${name}.weight`, input, output); this.registry.create(`${name}.bias`, [1, output], "zero"); };
    weight("token", BYTE_VOCABULARY_SIZE, config.width); weight("position", config.context, config.width);
    for (let i = 0; i < config.blocks; i++) {
      const prefix = `block.${i}`;
      norm(`${prefix}.norm1`); norm(`${prefix}.norm2`);
      for (const projection of ["q", "k", "v", "out"]) linear(`${prefix}.${projection}`, config.width, config.width);
      linear(`${prefix}.ff1`, config.width, config.feedForward); linear(`${prefix}.ff2`, config.feedForward, config.width);
    }
    norm("final"); linear("vocabulary", config.width, BYTE_VOCABULARY_SIZE);
  }
  parameters(): readonly Parameter[] { return this.registry.parameters(); }

  forward(batch: Batch, training = true): { logits: Float64Array; cache: object | null } {
    const { batchSize: b, sequenceLength: t } = batch, { width: d, heads: h } = this.config;
    if (!Number.isSafeInteger(b) || b < 1 || b > 32 || !Number.isSafeInteger(t) || t < 1 || t > this.config.context || batch.inputs.length !== b * t || batch.targets.length !== b * t || batch.targetMask.length !== b * t) throw new Error("Invalid batch shape.");
    if (batch.inputs.some((id) => id < 0 || id >= BYTE_VOCABULARY_SIZE) || batch.targets.some((id) => id < 0 || id >= BYTE_VOCABULARY_SIZE) || batch.targetMask.some((mask) => mask > 1)) throw new Error("Invalid batch values.");
    for (let row = 0; row < b; row++) {
      let padding = false;
      for (let col = 0; col < t; col++) {
        const index = row * t + col;
        if (batch.inputs[index] === PAD) padding = true;
        else if (padding) throw new Error("Inputs must be right-padded.");
        if (batch.targetMask[index] && (padding || batch.targets[index] === PAD)) throw new Error("Padding cannot have an active target.");
      }
      if (batch.inputs[row * t] === PAD) throw new Error("Empty batch sequence.");
    }
    const tape = new Tape();
    const parameters = new Map(this.parameters().map((p) => [p.name, tape.leaf(new Matrix(p.shape[0]!, p.shape[1]!, p.values), p)]));
    const p = (name: string) => parameters.get(name)!;
    const linear = (x: Node, name: string): Node => {
      const w = p(`${name}.weight`), bias = p(`${name}.bias`);
      const product = tape.op(matmul(x.value, w.value), x, w);
      return tape.op(addBias(product.value, bias.value), product, bias);
    };
    const norm = (x: Node, name: string): Node => {
      const gain = p(`${name}.gain`), bias = p(`${name}.bias`);
      return tape.op(layerNorm(x.value, gain.value, bias.value), x, gain, bias);
    };
    const tokens = tape.op(embedding(p("token").value, [...batch.inputs]), p("token"));
    const positions = tape.op(embedding(p("position").value, Array.from({ length: b * t }, (_, i) => i % t)), p("position"));
    let x = tape.op(add(tokens.value, positions.value), tokens, positions);
    for (let block = 0; block < this.config.blocks; block++) {
      const prefix = `block.${block}`, normalized = norm(x, `${prefix}.norm1`);
      const q = linear(normalized, `${prefix}.q`), k = linear(normalized, `${prefix}.k`), v = linear(normalized, `${prefix}.v`);
      const batches: Node[] = [], headWidth = d / h;
      for (let sample = 0; sample < b; sample++) {
        const mask = Uint8Array.from({ length: t * t }, (_, i) => Math.floor(i / t) >= i % t && batch.inputs[sample * t + i % t] !== PAD ? 1 : 0);
        const heads: Node[] = [];
        for (let head = 0; head < h; head++) {
          const indices = Array.from({ length: t * headWidth }, (_, i) => (sample * t + Math.floor(i / headWidth)) * d + head * headWidth + i % headWidth);
          const slice = (node: Node) => tape.op(gather(node.value, t, headWidth, indices), node);
          const qh = slice(q), kh = slice(k), vh = slice(v);
          const kt = tape.op(transpose(kh.value), kh), scores = tape.op(matmul(qh.value, kt.value), qh, kt);
          const scaled = tape.op(scale(scores.value, 1 / Math.sqrt(headWidth)), scores);
          const probabilities = tape.op(maskedSoftmax(scaled.value, mask), scaled);
          heads.push(tape.op(matmul(probabilities.value, vh.value), probabilities, vh));
        }
        batches.push(tape.op(concatenate(heads.map((node) => node.value), "cols"), ...heads));
      }
      const context = tape.op(concatenate(batches.map((node) => node.value), "rows"), ...batches);
      const projected = linear(context, `${prefix}.out`);
      x = tape.op(add(x.value, projected.value), x, projected);
      const ff1 = linear(norm(x, `${prefix}.norm2`), `${prefix}.ff1`);
      const hidden = tape.op(relu(ff1.value), ff1), ff2 = linear(hidden, `${prefix}.ff2`);
      x = tape.op(add(x.value, ff2.value), x, ff2);
    }
    const output = linear(norm(x, "final"), "vocabulary");
    const handle = training ? {} : null;
    if (handle) this.cache.set(handle, { tape, output });
    return { logits: output.value.data.slice(), cache: handle };
  }

  /** Accumulates into parameter gradients; callers clear them once per optimizer step. */
  backward(handle: object | null, dLogits: Float64Array): void {
    const cached = handle ? this.cache.get(handle) : undefined;
    if (!cached || dLogits.length !== cached.output.value.data.length || !dLogits.every(Number.isFinite)) throw new Error("Invalid or consumed backward cache/gradient.");
    this.cache.delete(handle!);
    cached.tape.backward(cached.output, dLogits);
    const updates = cached.tape.nodes.filter((node) => node.parameter).map((node) => ({ parameter: node.parameter!, values: node.gradient.data.map((value, index) => value + node.parameter!.gradients[index]!) }));
    if (updates.some((update) => !update.values.every(Number.isFinite))) throw new Error("Non-finite parameter gradient.");
    for (const update of updates) update.parameter.gradients.set(update.values);
  }
}
