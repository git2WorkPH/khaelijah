import type { DecoderConfig } from "../model/trainable/decoder.js";
import { DEFAULT_DECODER_CONFIG } from "../model/trainable/decoder.js";
export interface JobConfig { model: DecoderConfig; batchSize: number; steps: number; maxMilliseconds: number; maxRssBytes: number; }
export const DEFAULT_JOB: JobConfig = { model: { ...DEFAULT_DECODER_CONFIG }, batchSize: 1, steps: 10, maxMilliseconds: 60_000, maxRssBytes: 1024 ** 3 };
export function validateJob(value: unknown): JobConfig {
  const c = value as JobConfig;
  if (!c?.model) throw new Error("Invalid job config.");
  for (const [n, max] of [[c.steps, 2000], [c.batchSize, 4], [c.maxMilliseconds, 7_200_000], [c.maxRssBytes, 6 * 1024 ** 3], [c.model.context, 64], [c.model.width, 32], [c.model.blocks, 2], [c.model.heads, 4], [c.model.feedForward, 128]]) {
    if (!Number.isSafeInteger(n) || n! < 1 || n! > max!) throw new Error("Job exceeds bounded local policy.");
  }
  if (c.maxMilliseconds < 250 || !Number.isSafeInteger(c.model.seed) || c.model.seed < 0 || c.model.seed > 0xffffffff || c.model.width % c.model.heads) throw new Error("Invalid seed/dimensions/deadline.");
  return structuredClone(c);
}
