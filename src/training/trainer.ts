import { CausalDecoder, type Batch } from "../model/trainable/decoder.js";
import { BYTE_VOCABULARY_SIZE } from "../model/trainable/tokenizer.js";
import { maskedCrossEntropy } from "./loss.js";
import { AdamW } from "./optimizer.js";
import { setImmediate } from "node:timers/promises";
export interface TrainingOptions {
  maxSteps: number;
  maxMilliseconds: number;
  maxRssBytes: number;
  signal?: AbortSignal;
}
export const DEFAULT_TRAINING = {
  maxSteps: 2000,
  maxMilliseconds: 900000,
  maxRssBytes: 1024 ** 3,
};
export function evaluateLoss(
  model: CausalDecoder,
  batches: readonly Batch[],
): number {
  let total = 0,
    count = 0;
  for (const batch of batches) {
    const loss = maskedCrossEntropy(
      model.forward(batch, false).logits,
      batch.targets,
      batch.targetMask,
      BYTE_VOCABULARY_SIZE,
    );
    total += loss.loss * loss.validTokens;
    count += loss.validTokens;
  }
  if (!count) throw new Error("Empty evaluation dataset.");
  return total / count;
}
export async function train(
  model: CausalDecoder,
  batches: readonly Batch[],
  optimizer: AdamW,
  options: TrainingOptions = DEFAULT_TRAINING,
  runtime = {
    now: () => performance.now(),
    rss: () => process.memoryUsage().rss,
  },
) {
  if (
    !batches.length ||
    !Number.isSafeInteger(options.maxSteps) ||
    options.maxSteps < 1 ||
    !Number.isFinite(options.maxMilliseconds) ||
    options.maxMilliseconds <= 0 ||
    !Number.isFinite(options.maxRssBytes) ||
    options.maxRssBytes <= 0
  )
    throw new Error("Invalid training limits/data.");
  const parameters = model.parameters();
  if (
    optimizer.parameters.length !== parameters.length ||
    parameters.some((p, i) => p !== optimizer.parameters[i])
  )
    throw new Error("Optimizer belongs to a different model.");
  const started = runtime.now(),
    metrics: { step: number; loss: number; gradientNorm: number }[] = [];
  let stopReason: "max_steps" | "time_limit" | "memory_limit" | "cancelled" =
    "max_steps";
  for (let step = 0; step < options.maxSteps; step++) {
    await setImmediate(); // Permit cancellation and other events between complete steps.
    if (options.signal?.aborted) {
      stopReason = "cancelled";
      break;
    }
    if (runtime.now() - started >= options.maxMilliseconds) {
      stopReason = "time_limit";
      break;
    }
    if (runtime.rss() >= options.maxRssBytes) {
      stopReason = "memory_limit";
      break;
    }
    const batch = batches[optimizer.step % batches.length]!;
    model.registry.zeroGrad();
    const output = model.forward(batch);
    const loss = maskedCrossEntropy(
      output.logits,
      batch.targets,
      batch.targetMask,
      BYTE_VOCABULARY_SIZE,
    );
    model.backward(output.cache, loss.gradient);
    const gradientNorm = optimizer.update();
    metrics.push({ step: optimizer.step, loss: loss.loss, gradientNorm });
  }
  return {
    stopReason,
    completedSteps: metrics.length,
    nextBatch: optimizer.step % batches.length,
    elapsedMilliseconds: runtime.now() - started,
    metrics,
  };
}
