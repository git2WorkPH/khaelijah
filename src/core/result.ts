import type { EvidencePacket, GroundedPlan } from "./contracts.js";

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export interface ResponseValidationError {
  readonly code: "invalid_response" | "unknown_citation";
  readonly message: string;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function validateGroundedPlan(
  value: unknown,
  evidence: EvidencePacket,
): Result<GroundedPlan, ResponseValidationError> {
  if (typeof value !== "object" || value === null) {
    return { ok: false, error: { code: "invalid_response", message: "Response must be an object." } };
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.taskSummary !== "string" ||
    !Array.isArray(candidate.citations) ||
    !isStringArray(candidate.recommendations) ||
    !isStringArray(candidate.uncertainties)
  ) {
    return { ok: false, error: { code: "invalid_response", message: "Response does not match the grounded plan schema." } };
  }

  const passageIds = new Set(evidence.passages.map((passage) => passage.chunk.id));
  const citations: { passageId: string; claim: string }[] = [];
  for (const citation of candidate.citations) {
    if (
      typeof citation !== "object" ||
      citation === null ||
      typeof (citation as Record<string, unknown>).passageId !== "string" ||
      typeof (citation as Record<string, unknown>).claim !== "string"
    ) {
      return { ok: false, error: { code: "invalid_response", message: "Each citation must have a passage ID and claim." } };
    }
    const typedCitation = citation as { passageId: string; claim: string };
    if (!passageIds.has(typedCitation.passageId)) {
      return {
        ok: false,
        error: { code: "unknown_citation", message: `Citation '${typedCitation.passageId}' is not in the evidence packet.` },
      };
    }
    citations.push(typedCitation);
  }

  return {
    ok: true,
    value: {
      taskSummary: candidate.taskSummary,
      citations,
      recommendations: candidate.recommendations,
      uncertainties: candidate.uncertainties,
    },
  };
}
