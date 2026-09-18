# TASK-004 — Implement deterministic lexical retrieval

Task Status: APPROVED
Git Status: NOT_STARTED

## Requirement
- REQ-PROD-001
- REQ-FND-001

## Architecture decisions
- ADR-001

## Objective
Rank active technology-profile chunks through transparent lexical scoring and return provenance-complete passages.

## Scope
- Tokenization, deterministic BM25-style ranking, profile and lifecycle filtering, thresholds, and coverage warnings.

## Out of scope
- Embeddings, vector databases, rerankers, and remote retrieval services.

## Acceptance criteria
- [ ] Withdrawn and superseded chunks are never returned.
- [ ] Results have stable ranks, scores, sources, and retrieval timestamps.
- [ ] Empty and partial retrieval results return the specified warning behavior.

## Verification expectations
- Build, typecheck, lint, and unit tests must pass.

## Git
- Base branch: task/TASK-003-governed-ingestion
- Task branch: NOT_CREATED
- Commit: NOT_COMMITTED

