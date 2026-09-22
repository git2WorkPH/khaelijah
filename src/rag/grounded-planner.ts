import type { EvidencePacket, GroundedResponse, InferencePort, KnowledgeProfile } from "../core/contracts.js";
import { validateGroundedPlan } from "../core/result.js";
import { LexicalRetriever } from "../knowledge/retrieval.js";

export class GroundedPlanner {
  constructor(private readonly profile: KnowledgeProfile, private readonly retriever: LexicalRetriever, private readonly inference: InferencePort) {}

  async plan(task: string, requestId: string, at: string): Promise<GroundedResponse> {
    const outcome = this.retriever.search({ profileId: this.profile.id, query: task, limit: this.profile.retrievalPolicy.maxResults, retrievedAt: at });
    const evidence: EvidencePacket = { requestId, profileId: this.profile.id, query: task, passages: outcome.passages, retrievalWarnings: outcome.warnings, createdAt: at };
    if (evidence.passages.length === 0) return { status: "insufficient_evidence", reason: "No active passage met the retrieval threshold.", evidence };
    if (evidence.passages.some((passage) => passage.chunk.lifecycle !== "active" || passage.source.lifecycle !== "active")) {
      return { status: "stale_evidence", reason: "Retrieved evidence is no longer active.", evidence };
    }
    const generated = await this.inference.generate({ task, evidence, outputSchema: "grounded-implementation-plan-v1" });
    const current = this.retriever.search({ profileId: this.profile.id, query: task, limit: this.profile.retrievalPolicy.maxResults, retrievedAt: at });
    const currentIds = new Set(current.passages.map((passage) => passage.chunk.id));
    if (evidence.passages.some((passage) => !currentIds.has(passage.chunk.id))) {
      return { status: "stale_evidence", reason: "Evidence changed during inference; retrieve again.", evidence };
    }
    const validated = validateGroundedPlan(generated, evidence);
    if (!validated.ok) return { status: "invalid_citation", reason: validated.error.message, evidence };
    return { status: "grounded", plan: validated.value, evidence };
  }
}
