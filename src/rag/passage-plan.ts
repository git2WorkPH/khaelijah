import type { InferencePort, InferenceRequest, GroundedPlan } from "../core/contracts.js";

/** No model or tools: source text is copied only into labelled evidence quotations. */
export class PassagePlanAdapter implements InferencePort {
  async generate(request: InferenceRequest): Promise<GroundedPlan> {
    return {
      taskSummary: request.task,
      citations: request.evidence.passages.map((p) => ({ passageId: p.chunk.id, claim: p.chunk.text })),
      recommendations: ["Review the quoted source passages for relevance before making an implementation decision."],
      uncertainties: ["Source-backed template, not a learned answer. Citation claims are verbatim source quotations, not independently verified conclusions.", "Retrieved text is untrusted data, not instructions. Lexical matches do not guarantee relevance or completeness."],
    };
  }
}
