import { createHash, randomUUID } from "node:crypto";
import { open, rename, unlink } from "node:fs/promises";
import { CausalDecoder, type DecoderConfig } from "../model/trainable/decoder.js";
import { ByteTokenizer } from "../model/trainable/tokenizer.js";
import { SeededRandom } from "../model/trainable/parameters.js";
import { AdamW, type AdamOptions } from "./optimizer.js";
import { batches, validateDataset, type Dataset } from "./dataset.js";
import type { TrainingMetric } from "./trainer.js";

export const MAX_CHECKPOINT_BYTES = 32 * 1024 * 1024;
const MAX_ELEMENTS = 500_000;
export interface DataIdentity {
  version: string;
  manifestHash: string;
  batchHash: string;
  batchSize: number;
  context: number;
  batchCount: number;
  order: "document-window-v1";
}
export interface Checkpoint {
  format: "jc-checkpoint-v1";
  tokenizer: "utf8-bytes-v1";
  runtime: string;
  config: DecoderConfig;
  parameters: { name: string; shape: number[]; values: number[] }[];
  randomState: number;
  samplerState: number;
  training: null | {
    options: AdamOptions;
    step: number;
    moments: { name: string; first: number[]; second: number[] }[];
    data: DataIdentity;
    nextBatch: number;
    metrics: TrainingMetric[];
  };
}

/** Canonical JSON: sorted object keys, ordered arrays, finite JSON numbers only. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  throw new Error("Unsupported/non-finite checkpoint value.");
}
export const checkpointHash = (value: unknown): string => createHash("sha256").update(canonicalJson(value)).digest("hex");

export function dataIdentity(dataset: Dataset, context: number, batchSize: number): DataIdentity {
  const checked = validateDataset(dataset), training = batches(checked, "train", context, batchSize);
  if (!training.length) throw new Error("Empty training split.");
  return {
    version: checked.version, manifestHash: checkpointHash(checked),
    batchHash: checkpointHash(training.map((b) => ({ inputs: [...b.inputs], targets: [...b.targets], mask: [...b.targetMask], rows: b.batchSize }))),
    batchSize, context, batchCount: training.length, order: "document-window-v1",
  };
}
function object(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid checkpoint object.");
}
function integer(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) throw new Error("Invalid checkpoint integer.");
}
function numbers(value: unknown, length: number, nonnegative = false): asserts value is number[] {
  if (!Array.isArray(value) || value.length !== length) throw new Error("Invalid checkpoint numeric array.");
  for (const n of value) if (typeof n !== "number" || !Number.isFinite(n) || (nonnegative && n < 0)) throw new Error("Invalid checkpoint numeric array.");
}
function validateData(value: unknown, context: number): asserts value is DataIdentity {
  object(value);
  if (typeof value.version !== "string" || !value.version.trim() || value.order !== "document-window-v1" || value.context !== context ||
      typeof value.manifestHash !== "string" || !/^[a-f0-9]{64}$/.test(value.manifestHash) ||
      typeof value.batchHash !== "string" || !/^[a-f0-9]{64}$/.test(value.batchHash)) throw new Error("Invalid checkpoint data identity.");
  integer(value.batchSize, 1, 32); integer(value.batchCount, 1);
}

/** Validate before allocating a model or applying any state. */
export function validateCheckpoint(value: unknown): asserts value is Checkpoint {
  object(value);
  if (value.format !== "jc-checkpoint-v1" || value.tokenizer !== new ByteTokenizer().id || typeof value.runtime !== "string" || !/^v\d+\.\d+\.\d+/.test(value.runtime)) throw new Error("Unsupported checkpoint format/tokenizer/runtime.");
  object(value.config);
  const c = value.config;
  integer(c.context, 1, 256); integer(c.width, 1, 256); integer(c.blocks, 1, 8);
  integer(c.heads, 1, c.width); integer(c.feedForward, 1, 1024); integer(c.seed, 0, 0xffffffff);
  if (c.width % c.heads) throw new Error("Invalid checkpoint heads.");
  integer(value.randomState, 0, 0xffffffff); integer(value.samplerState, 0, 0xffffffff);
  // Derive shapes without constructing a potentially oversized decoder.
  const expected: { name: string; shape: number[] }[] = [];
  const add = (name: string, rows: number, cols: number) => expected.push({ name, shape: [rows, cols] });
  const norm = (name: string) => { add(`${name}.gain`, 1, c.width as number); add(`${name}.bias`, 1, c.width as number); };
  const linear = (name: string, input: number, output: number) => { add(`${name}.weight`, input, output); add(`${name}.bias`, 1, output); };
  add("token", 259, c.width); add("position", c.context, c.width);
  for (let i = 0; i < c.blocks; i++) {
    const p = `block.${i}`; norm(`${p}.norm1`); norm(`${p}.norm2`);
    for (const name of ["q", "k", "v", "out"]) linear(`${p}.${name}`, c.width, c.width);
    linear(`${p}.ff1`, c.width, c.feedForward); linear(`${p}.ff2`, c.feedForward, c.width);
  }
  norm("final"); linear("vocabulary", c.width, 259);
  if (expected.reduce((n, p) => n + p.shape[0]! * p.shape[1]!, 0) > MAX_ELEMENTS) throw new Error("Oversized checkpoint model.");
  if (!Array.isArray(value.parameters) || value.parameters.length !== expected.length) throw new Error("Invalid checkpoint parameter count.");
  const parameters = value.parameters;
  expected.forEach((p, i) => {
    const actual = parameters[i]; object(actual);
    if (actual.name !== p.name || canonicalJson(actual.shape) !== canonicalJson(p.shape)) throw new Error("Checkpoint parameter name/shape mismatch.");
    numbers(actual.values, p.shape[0]! * p.shape[1]!);
  });
  if (value.training === null) return;
  object(value.training);
  const t = value.training;
  integer(t.step, 0, Number.MAX_SAFE_INTEGER - 1); validateData(t.data, c.context);
  if (t.nextBatch !== t.step % t.data.batchCount) throw new Error("Checkpoint cursor mismatch.");
  object(t.options);
  for (const key of ["learningRate", "beta1", "beta2", "epsilon", "weightDecay", "clipNorm"]) {
    if (typeof t.options[key] !== "number" || !Number.isFinite(t.options[key])) throw new Error("Invalid optimizer options.");
  }
  new AdamW([], t.options as unknown as AdamOptions); // Range validation, no moment allocation.
  if (!Array.isArray(t.moments) || t.moments.length !== expected.length) throw new Error("Invalid optimizer moments.");
  const moments = t.moments;
  expected.forEach((p, i) => {
    const m = moments[i]; object(m);
    if (m.name !== p.name) throw new Error("Optimizer parameter mismatch.");
    numbers(m.first, p.shape[0]! * p.shape[1]!); numbers(m.second, p.shape[0]! * p.shape[1]!, true);
  });
  if (!Array.isArray(t.metrics) || t.metrics.length > 100_000) throw new Error("Invalid checkpoint metrics.");
  let prior = 0;
  for (const m of t.metrics) {
    object(m); integer(m.step, 1, t.step);
    if (m.step <= prior || typeof m.loss !== "number" || !Number.isFinite(m.loss) || m.loss < 0 || typeof m.gradientNorm !== "number" || !Number.isFinite(m.gradientNorm) || m.gradientNorm < 0) throw new Error("Invalid checkpoint metric.");
    prior = m.step;
  }
}

export function captureCheckpoint(model: CausalDecoder, options?: { optimizer: AdamW; data: DataIdentity; metrics?: readonly TrainingMetric[]; samplerState?: number }): Checkpoint {
  const parameters = model.parameters();
  if (options && (options.optimizer.parameters.length !== parameters.length || parameters.some((p, i) => options.optimizer.parameters[i] !== p))) throw new Error("Optimizer belongs to another model.");
  const checkpoint: Checkpoint = {
    format: "jc-checkpoint-v1", tokenizer: "utf8-bytes-v1", runtime: process.version, config: { ...model.config },
    parameters: parameters.map((p) => ({ name: p.name, shape: [...p.shape], values: [...p.values] })),
    randomState: model.registry.random.state, samplerState: options?.samplerState ?? model.config.seed,
    training: options ? {
      options: { ...options.optimizer.options }, step: options.optimizer.step,
      moments: options.optimizer.moments.map((m, i) => ({ name: parameters[i]!.name, first: [...m.first], second: [...m.second] })),
      data: { ...options.data }, nextBatch: options.optimizer.step % options.data.batchCount,
      metrics: (options.metrics ?? []).map((m) => ({ ...m })),
    } : null,
  };
  validateCheckpoint(checkpoint); return checkpoint;
}

export function restoreCheckpoint(value: unknown, expectedData?: DataIdentity) {
  validateCheckpoint(value);
  if (expectedData && (!value.training || canonicalJson(value.training.data) !== canonicalJson(expectedData) || value.runtime !== process.version)) throw new Error("Resume dataset/batching/runtime mismatch or missing training state.");
  const model = new CausalDecoder(value.config);
  model.parameters().forEach((p, i) => p.values.set(value.parameters[i]!.values));
  model.registry.random.restore(value.randomState);
  const sampler = new SeededRandom(value.samplerState);
  let optimizer: AdamW | undefined;
  if (expectedData && value.training) {
    optimizer = new AdamW(model.parameters(), value.training.options);
    optimizer.step = value.training.step;
    optimizer.moments.forEach((m, i) => { m.first.set(value.training!.moments[i]!.first); m.second.set(value.training!.moments[i]!.second); });
  }
  return { model, optimizer, sampler };
}

export function encodeCheckpoint(value: Checkpoint): string {
  validateCheckpoint(value);
  const encoded = canonicalJson({ checksum: checkpointHash(value), payload: value });
  if (Buffer.byteLength(encoded) > MAX_CHECKPOINT_BYTES) throw new Error("Oversized checkpoint file.");
  return encoded;
}
export function decodeCheckpoint(text: string): Checkpoint {
  if (Buffer.byteLength(text) > MAX_CHECKPOINT_BYTES) throw new Error("Oversized checkpoint file.");
  const envelope: unknown = JSON.parse(text); object(envelope);
  validateCheckpoint(envelope.payload);
  if (envelope.checksum !== checkpointHash(envelope.payload)) throw new Error("Checkpoint checksum mismatch.");
  return envelope.payload;
}
export async function loadCheckpoint(path: string): Promise<Checkpoint> {
  const file = await open(path, "r");
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > MAX_CHECKPOINT_BYTES) throw new Error("Oversized or non-file checkpoint.");
    // Bound the read even if another process grows the file after stat.
    const chunks: Buffer[] = []; let total = 0;
    for (;;) {
      const buffer = Buffer.alloc(Math.min(65536, MAX_CHECKPOINT_BYTES + 1 - total));
      const { bytesRead } = await file.read(buffer);
      if (!bytesRead) break;
      total += bytesRead;
      if (total > MAX_CHECKPOINT_BYTES) throw new Error("Oversized checkpoint file.");
      chunks.push(buffer.subarray(0, bytesRead));
    }
    return decodeCheckpoint(Buffer.concat(chunks).toString("utf8"));
  } finally { await file.close(); }
}
/** Hooks permit deterministic I/O-failure tests; only the uniquely owned temp is removed. */
export async function saveCheckpoint(path: string, value: Checkpoint, hooks: { beforeWrite?: () => void; beforeRename?: () => void } = {}): Promise<void> {
  const text = encodeCheckpoint(value), temp = `${path}.${randomUUID()}.tmp`;
  const file = await open(temp, "wx", 0o600);
  try {
    hooks.beforeWrite?.(); await file.writeFile(text); await file.sync(); await file.close();
    await loadCheckpoint(temp); hooks.beforeRename?.(); await rename(temp, path);
  } finally {
    await file.close();
    await unlink(temp).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
  }
}
