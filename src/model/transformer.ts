import type { GroundedPlan, InferencePort, InferenceRequest } from "../core/contracts.js";

export interface TransformerConfig { readonly vocabularySize: number; readonly dimensions: number; }

function seeded(index: number): number { return ((index * 1103515245 + 12345) >>> 0) / 0xffffffff - 0.5; }
function dot(left: readonly number[], right: readonly number[]): number { return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0); }
function softmax(values: readonly number[]): number[] {
  const max = Math.max(...values); const exps = values.map((value) => Math.exp(value - max)); const total = exps.reduce((sum, value) => sum + value, 0);
  return exps.map((value) => value / total);
}

function project(input: readonly number[], width: number, seed: number): number[] {
  return Array.from({ length: width }, (_, column) => input.reduce((sum, value, row) => sum + value * seeded(seed + row * width + column), 0) / Math.sqrt(input.length));
}
function normalize(input: readonly number[]): number[] {
  const mean = input.reduce((sum, value) => sum + value, 0) / input.length;
  const variance = input.reduce((sum, value) => sum + (value - mean) ** 2, 0) / input.length;
  return input.map((value) => (value - mean) / Math.sqrt(variance + 1e-5));
}

export class VocabularyTokenizer {
  encode(text: string): number[] {
    return text.toLowerCase().match(/[a-z0-9]+/gu)?.map((token) => {
      let hash = 2166136261;
      for (const char of token) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
      return 1 + ((hash >>> 0) % 8191);
    }) ?? [];
  }
}

/** A small, inspectable single-head Transformer encoder with deterministic fixed weights. */
export class TinyTransformer {
  constructor(private readonly config: TransformerConfig) {
    if (!Number.isInteger(config.dimensions) || config.dimensions < 2 || !Number.isInteger(config.vocabularySize) || config.vocabularySize < 2) throw new Error("Invalid model configuration.");
  }

  forward(tokenIds: readonly number[]): number[] {
    if (tokenIds.length > 256 || tokenIds.some((id) => !Number.isInteger(id) || id < 0 || id >= this.config.vocabularySize)) throw new Error("Invalid token sequence.");
    if (tokenIds.length === 0) return Array(this.config.dimensions).fill(0);
    const width = this.config.dimensions;
    const embeddings = tokenIds.map((id, position) => Array.from({ length: width }, (_, dimension) => {
      const angle = position / 10000 ** (2 * Math.floor(dimension / 2) / width);
      return seeded(id * 31 + dimension) + (dimension % 2 === 0 ? Math.sin(angle) : Math.cos(angle));
    }));
    const keys = embeddings.map((row) => project(row, width, 20000));
    const values = embeddings.map((row) => project(row, width, 30000));
    const attention = embeddings.map((embedding) => {
      const query = project(embedding, width, 10000);
      const weights = softmax(keys.map((key) => dot(query, key) / Math.sqrt(width)));
      const context = embedding.map((_, dimension) => weights.reduce((sum, weight, index) => sum + weight * values[index]![dimension]!, 0));
      const projected = project(context, width, 40000);
      const residual = normalize(embedding.map((value, dimension) => value + projected[dimension]!));
      const hidden = project(residual, width * 4, 50000).map((value) => Math.max(0, value));
      const output = project(hidden, width, 60000);
      return normalize(residual.map((value, dimension) => value + output[dimension]!));
    });
    return attention[0]!.map((_, dimension) => {
      const mean = attention.reduce((sum, vector) => sum + vector[dimension]!, 0) / attention.length;
      return mean;
    });
  }
}

/** Produces a deliberately bounded plan draft; RAG validates it before any user-facing response. */
export class TransformerPlanAdapter implements InferencePort {
  private readonly tokenizer = new VocabularyTokenizer();
  private readonly transformer = new TinyTransformer({ vocabularySize: 8192, dimensions: 8 });

  async generate(request: InferenceRequest): Promise<unknown> {
    const activation = this.transformer.forward(this.tokenizer.encode(`${request.task} ${request.evidence.passages.map((passage) => passage.chunk.text).join(" ")}`).slice(0, 256));
    if (!activation.every(Number.isFinite)) throw new Error("Non-finite model output.");
    const citations = request.evidence.passages.map((passage) => ({
      passageId: passage.chunk.id,
      claim: passage.chunk.text,
    }));
    const draft: GroundedPlan = {
      taskSummary: request.task,
      citations,
      recommendations: ["Review the retrieved engineering guidance before implementing the requested application change."],
      uncertainties: [
        "Prototype: fixed untrained attention weights; recommendations are templates, not learned application plans.",
        "Automatic semantic conflict detection is not implemented; review sources for disagreement.",
        ...request.evidence.retrievalWarnings,
      ],
    };
    return draft;
  }
}
