# REQ-PROD-001 — Grounded application-building assistance

Status: ACTIVE

## Requirement

The product must help a developer turn a scoped application request into a grounded response or implementation plan by combining a custom TypeScript Transformer with evidence retrieved from an approved knowledge profile. The result must distinguish retrieved evidence from model-generated recommendations and include provenance for material retrieved claims.

## Rationale

The system's intended value is practical application-building help that remains useful as technology and other approved domains change. Separating current knowledge from learned capabilities makes updates auditable and avoids the infeasible goal of training on the entire internet.

## Scope

- Receive a natural-language application request.
- Retrieve relevant information from one approved knowledge profile.
- Provide source/provenance information with material claims based on retrieval.
- Produce a structured plan or answer suitable for developer review.
- Record enough data to evaluate retrieval relevance and response grounding.

## Out of scope

- Autonomous production deployment or unapproved workspace changes.
- Whole-internet ingestion or training.
- Medical diagnosis or treatment advice.
- Multi-profile routing and multi-agent orchestration in the first slice.

## Acceptance criteria

- [ ] A user can select one approved knowledge profile and submit a scoped application request.
- [ ] The system retrieves passages from that profile and retains provenance for every passage supplied to inference.
- [ ] The returned plan or answer identifies material retrieved sources and separates evidence from recommendations.
- [ ] An evaluation fixture can measure retrieval relevance and whether cited evidence supports the response.
- [ ] The end-to-end path executes with TypeScript product runtime code only.

## Dependencies

- ADR-001
- REQ-FND-001

## Notes

- A local technology profile is the expected initial profile. Medical knowledge requires a dedicated governance and safety requirement before implementation.
