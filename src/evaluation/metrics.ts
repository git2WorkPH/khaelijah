import type { GroundedResponse } from "../core/contracts.js";
import type { EvaluationFixture } from "./fixtures.js";

export interface EvaluationResult { readonly fixtureId: string; readonly recallAt3: number; readonly ndcgAt3: number; readonly provenanceComplete: boolean; readonly citationValid: boolean; readonly safeInsufficiency: boolean; }

export function evaluateResponse(fixture: EvaluationFixture, response: GroundedResponse): EvaluationResult {
  const documents = response.evidence.passages.slice(0, 3).map((passage) => passage.chunk.documentId);
  const found = fixture.expectedDocumentId !== undefined && documents.includes(fixture.expectedDocumentId);
  const rank = fixture.expectedDocumentId === undefined ? -1 : documents.indexOf(fixture.expectedDocumentId);
  const provenanceComplete = response.evidence.passages.every((passage) => Boolean(passage.source.canonicalUrl && passage.source.licenseOrAccess && passage.chunk.ingestedAt));
  const citationValid = response.status !== "grounded" || response.plan.citations.every((citation) => response.evidence.passages.some((passage) => passage.chunk.id === citation.passageId));
  return { fixtureId: fixture.id, recallAt3: found ? 1 : 0, ndcgAt3: rank < 0 ? 0 : 1 / Math.log2(rank + 2), provenanceComplete, citationValid, safeInsufficiency: fixture.expectsInsufficiency === true ? response.status === "insufficient_evidence" : true };
}
