import type { GroundedPlan, InferencePort, InferenceRequest } from "../core/contracts.js";

export interface TransformerConfig { readonly vocabularySize: number; readonly dimensions: number; }

function seeded(index: number): number { return ((index * 1103515245 + 12345) >>> 0) / 0xffffffff - 0.5; }
function dot(left: readonly number[], right: readonly number[]): number { return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0); }
function softmax(values: readonly number[]): number[] {
  const max = Math.max(...values); const exps = values.map((value) => Math.exp(value - max)); const total = exps.reduce((sum, value) => sum + value, 0);
  return exps.map((value) => value / total);
}

export class VocabularyTokenizer {
  private readonly ids = new Map<string, number>();
  encode(text: string): number[] {
    return text.toLowerCase().match(/[a-z0-9]+/gu)?.map((token) => {
      if (!this.ids.has(token)) this.ids.set(token, this.ids.size + 1);
      return this.ids.get(token)!;
    }) ?? [];
  }
}

/** A small, inspectable single-head Transformer encoder with deterministic fixed weights. */
export class TinyTransformer {
  constructor(private readonly config: TransformerConfig) {}

  forward(tokenIds: readonly number[]): number[] {
    if (tokenIds.length === 0) return Array(this.config.dimensions).fill(0);
    const embeddings = tokenIds.map((id) => Array.from({ length: this.config.dimensions }, (_, dimension) => seeded(id * 31 + dimension)));
    const attention = embeddings.map((query) => {
      const weights = softmax(embeddings.map((key) => dot(query, key) / Math.sqrt(this.config.dimensions)));
      return embeddings[0]!.map((_, dimension) => weights.reduce((sum, weight, index) => sum + weight * embeddings[index]![dimension]!, 0));
    });
    return attention[0]!.map((_, dimension) => {
      const mean = attention.reduce((sum, vector) => sum + vector[dimension]!, 0) / attention.length;
      return Math.max(0, mean); // deterministic feed-forward activation
    });
  }
}

/** Produces a deliberately bounded plan draft; RAG validates it before any user-facing response. */
export class TransformerPlanAdapter implements InferencePort {
  private readonly tokenizer = new VocabularyTokenizer();
  private readonly transformer = new TinyTransformer({ vocabularySize: 8192, dimensions: 8 });

  async generate(request: InferenceRequest): Promise<unknown> {
    const activation = this.transformer.forward(this.tokenizer.encode(`${request.task} ${request.evidence.query}`));
    const confidence = activation.reduce((sum, value) => sum + value, 0).toFixed(3);
    const citations = request.evidence.passages.map((passage) => ({
      passageId: passage.chunk.id,
      claim: passage.chunk.text,
    }));
    const draft: GroundedPlan = {
      taskSummary: request.task,
      citations,
      recommendations: ["Review the retrieved engineering guidance before implementing the requested application change."],
      uncertainties: request.evidence.retrievalWarnings.length > 0
        ? [`Retrieval warnings: ${request.evidence.retrievalWarnings.join(", ")}.`]
        : [`Deterministic model activation: ${confidence}. Human review remains required.`],
    };
    return draft;
  }
}
