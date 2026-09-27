import { CausalDecoder } from "./decoder.js";
import { SeededRandom } from "./parameters.js";
import { BOS, EOS, PAD, BYTE_VOCABULARY_SIZE, ByteTokenizer } from "./tokenizer.js";

export interface GenerationOptions { maxNewTokens?: number; temperature?: number; topK?: number; random?: SeededRandom; }
/** Read-only model evaluation. Only the caller-owned sampler advances in sampling mode. */
export function generate(model: CausalDecoder, prompt: string, options: GenerationOptions = {}) {
  const maxNewTokens = options.maxNewTokens ?? 64, temperature = options.temperature ?? 0, topK = options.topK ?? 257;
  if (typeof prompt !== "string" || Buffer.byteLength(prompt) > 65536 || !Number.isInteger(maxNewTokens) || maxNewTokens < 1 || maxNewTokens > 256 || !Number.isFinite(temperature) || temperature < 0 || !Number.isInteger(topK) || topK < 1 || topK > 257 || (temperature > 0 && !options.random)) throw new Error("Invalid generation settings/prompt.");
  if (options.random) new SeededRandom(options.random.state); // Validate before advancing caller-owned state.
  const tokenizer = new ByteTokenizer(), tokens = [BOS, ...tokenizer.encode(prompt)], generated: number[] = [];
  let stopReason: "eos" | "max_tokens" = "max_tokens";
  for (let step = 0; step < maxNewTokens; step++) {
    const inputs = Int32Array.from(tokens.slice(-model.config.context)), time = inputs.length;
    const logits = model.forward({ inputs, targets: new Int32Array(time), targetMask: new Uint8Array(time), batchSize: 1, sequenceLength: time }, false).logits.slice((time - 1) * BYTE_VOCABULARY_SIZE);
    if (!logits.every(Number.isFinite)) throw new Error("Non-finite generation logits.");
    const candidates = [...logits.keys()].filter((id) => id !== PAD && id !== BOS).sort((a, b) => logits[b]! - logits[a]! || a - b).slice(0, topK);
    let token = candidates[0]!;
    if (temperature > 0) {
      const weights = candidates.map((id) => Math.exp((logits[id]! - logits[token]!) / temperature));
      let draw = options.random!.next() * weights.reduce((sum, w) => sum + w, 0);
      for (let i = 0; i < candidates.length; i++) { draw -= weights[i]!; if (draw < 0) { token = candidates[i]!; break; } }
    }
    if (token === EOS) { stopReason = "eos"; break; }
    generated.push(token); tokens.push(token);
  }
  return { text: tokenizer.decode(generated), tokens: generated, stopReason };
}
