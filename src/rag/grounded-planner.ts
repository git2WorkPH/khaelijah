import type { EvidencePacket, GroundedResponse, InferencePort, KnowledgeProfile, RetrievalPort } from "../core/contracts.js";
import { validateGroundedPlan } from "../core/result.js";

export class GroundedPlanner {
  constructor(private readonly profile: KnowledgeProfile, private readonly retriever: RetrievalPort, private readonly inference: InferencePort) {}

  async plan(task: string, requestId: string, at: string): Promise<GroundedResponse> {
    const outcome = await this.retriever.retrieve({ profileId: this.profile.id, query: task, limit: this.profile.retrievalPolicy.maxResults, retrievedAt: at });
    const evidence: EvidencePacket = { requestId, profileId: this.profile.id, query: task, passages: outcome.passages, retrievalWarnings: outcome.warnings, createdAt: at };
    if (evidence.passages.length === 0) return { status: "insufficient_evidence", reason: "No active passage met the retrieval threshold.", evidence };
    if (!(await this.retriever.isCurrent(evidence.passages))) {
      return { status: "stale_evidence", reason: "Retrieved evidence is no longer active.", evidence };
    }
    const generated = await this.inference.generate({ task, evidence: structuredClone(evidence), outputSchema: "grounded-implementation-plan-v1" });
    if (!(await this.retriever.isCurrent(evidence.passages))) {
      return { status: "stale_evidence", reason: "Evidence changed during inference; retrieve again.", evidence };
    }
    const validated = validateGroundedPlan(generated, evidence);
    if (!validated.ok) return { status: "invalid_citation", reason: validated.error.message, evidence };
    return { status: "grounded", plan: validated.value, evidence };
  }
}
