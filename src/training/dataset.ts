import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { ByteTokenizer, PAD } from "../model/trainable/tokenizer.js";
import type { Batch } from "../model/trainable/decoder.js";

export interface TrainingDocument { id: string; source: string; license: string; split: "train" | "validation" | "test"; text: string; sha256: string; }
export interface Dataset { version: string; documents: TrainingDocument[]; }
export function digest(text: string): string { return createHash("sha256").update(text).digest("hex"); }
export function validateDataset(value: unknown): Dataset {
  if (!value || typeof value !== "object") throw new Error("Invalid dataset.");
  const data = value as Dataset;
  if (typeof data.version !== "string" || !data.version.trim() || !Array.isArray(data.documents) || !data.documents.length) throw new Error("Invalid manifest.");
  const ids = new Set<string>(), hashes = new Map<string, string>();
  for (const document of data.documents) {
    if (!document || [document.id, document.source, document.license, document.text, document.sha256].some((v) => typeof v !== "string" || !v.trim()) || !["train", "validation", "test"].includes(document.split)) throw new Error("Invalid document metadata.");
    if (ids.has(document.id)) throw new Error("Duplicate document ID.");
    if (digest(document.text) !== document.sha256) throw new Error("Document hash mismatch.");
    if (hashes.has(document.sha256) && hashes.get(document.sha256) !== document.split) throw new Error("Cross-split duplicate.");
    ids.add(document.id); hashes.set(document.sha256, document.split);
  }
  return structuredClone(data);
}
export function loadDataset(path: string | URL): Dataset { return validateDataset(JSON.parse(readFileSync(path, "utf8")) as unknown); }
export function batches(dataset: Dataset, split: TrainingDocument["split"], context: number, batchSize: number): Batch[] {
  validateDataset(dataset);
  if (!Number.isInteger(context) || context < 1 || context > 256 || !Number.isInteger(batchSize) || batchSize < 1 || batchSize > 32) throw new Error("Invalid batch configuration.");
  const tokenizer = new ByteTokenizer(), windows: { inputs: number[]; targets: number[] }[] = [];
  for (const document of dataset.documents.filter((d) => d.split === split)) {
    const tokens = [...tokenizer.encode(document.text, true)];
    for (let start = 0; start < tokens.length - 1; start += context) windows.push({ inputs: tokens.slice(start, start + context), targets: tokens.slice(start + 1, start + context + 1) });
  }
  const result: Batch[] = [];
  for (let start = 0; start < windows.length; start += batchSize) {
    const group = windows.slice(start, start + batchSize);
    const inputs = new Int32Array(group.length * context).fill(PAD), targets = inputs.slice(), targetMask = new Uint8Array(inputs.length);
    group.forEach((window, row) => {
      inputs.set(window.inputs.slice(0, window.targets.length), row * context); targets.set(window.targets, row * context);
      targetMask.fill(1, row * context, row * context + window.targets.length);
    });
    result.push({ inputs, targets, targetMask, batchSize: group.length, sequenceLength: context });
  }
  return result;
}
