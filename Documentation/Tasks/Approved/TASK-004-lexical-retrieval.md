# TASK-004 — Implement deterministic lexical retrieval

Task Status: VERIFIED
Git Status: MERGED

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
- [x] Withdrawn and superseded chunks are never returned.
- [x] Results have stable ranks, scores, sources, and retrieval timestamps.
- [x] Empty and partial retrieval results return the specified warning behavior.

## Verification expectations
- Build, typecheck, lint, and unit tests must pass.

## Git
- Base branch: task/TASK-003-governed-ingestion
- Task branch: task/TASK-004-lexical-retrieval
- Commit: 4c83836

## Implementation summary
- Added deterministic BM25-style lexical ranking over active profile chunks with stable ranks and provenance-complete passages.
- Added explicit insufficient-evidence, partial-coverage, unknown-profile, and empty-query outcomes.

## Verification evidence
- `pnpm run build && pnpm run typecheck && pnpm run lint && pnpm test` — PASS (8 tests)

## Technical handover — 2026-09-27

- Delivery: complete; implementation/design commit `4c83836` is included in master and origin/master at handover baseline `35ee33e`.
- Code/evidence to read: src/knowledge/retrieval.ts; test/retrieval.test.ts.
- Remaining work in this original task: none; later capabilities are follow-on scope, not unfinished acceptance.
- Integration notes: BM25-style local retrieval and SQLite FTS5 return different shapes/scores. Do not silently reuse thresholds across them. A persistent retrieval adapter must map profile, lifecycle, provenance, and insufficiency explicitly.
- Recheck: pnpm test (retrieval tests).
- Cross-task resume instructions: [technical handover](../../SessionMemory/TECHNICAL-HANDOVER.md). Historical test counts above describe the original task; the current baseline is 51 passing tests.
