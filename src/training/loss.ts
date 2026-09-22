import { PAD } from "../model/trainable/tokenizer.js";

export interface LossResult { readonly loss: number; readonly perplexity: number | null; readonly validTokens: number; readonly gradient: Float64Array; }

/** Stable mean token NLL in nats. Null perplexity means exp(loss) overflow. */
export function maskedCrossEntropy(logits: Float64Array, targets: Int32Array, mask: Uint8Array, vocabularySize: number): LossResult {
  if (!Number.isSafeInteger(vocabularySize) || vocabularySize < 2 || targets.length === 0 || logits.length !== targets.length * vocabularySize || mask.length !== targets.length || !logits.every(Number.isFinite) || mask.some((value) => value > 1) || targets.some((id) => id < 0 || id >= vocabularySize)) throw new Error("Invalid loss input.");
  const validTokens = mask.reduce((sum, value) => sum + value, 0);
  if (validTokens === 0) throw new Error("Loss requires an active target.");
  const gradient = new Float64Array(logits.length);
  let loss = 0;
  for (let row = 0; row < targets.length; row++) {
    if (!mask[row]) continue;
    if (targets[row] === PAD) throw new Error("PAD target must be masked.");
    const offset = row * vocabularySize;
    let max = -Infinity;
    for (let col = 0; col < vocabularySize; col++) max = Math.max(max, logits[offset + col]!);
    let total = 0;
    for (let col = 0; col < vocabularySize; col++) total += Math.exp(logits[offset + col]! - max);
    loss += (Math.log(total) + (max - logits[offset + targets[row]!]!)) / validTokens;
    for (let col = 0; col < vocabularySize; col++) gradient[offset + col] = (Math.exp(logits[offset + col]! - max) / total - (col === targets[row] ? 1 : 0)) / validTokens;
  }
  if (!Number.isFinite(loss) || !gradient.every(Number.isFinite)) throw new Error("Loss overflow.");
  const perplexity = Math.exp(loss);
  return { loss, gradient, validTokens, perplexity: Number.isFinite(perplexity) ? perplexity : null };
}
