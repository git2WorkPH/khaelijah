# TASK-003 — Implement governed local corpus ingestion

Task Status: VERIFIED
Git Status: MERGED

## Requirement
- REQ-FND-001

## Architecture decisions
- ADR-001

## Objective
Parse a local Markdown technology corpus into source records and lifecycle-governed chunks with auditable refresh results.

## Scope
- Front-matter parsing, metadata validation, deterministic chunking, content hashing, and in-memory lifecycle updates.
- Active, superseded, and withdrawn retrieval eligibility plus refresh audit records.

## Out of scope
- Network fetching, scheduled jobs, databases, or vector indexes.

## Acceptance criteria
- [x] Valid documents ingest into traceable source and chunk records.
- [x] Updates supersede prior chunks and withdrawals exclude chunks from active retrieval.
- [x] Refresh results report additions, updates, withdrawals, and failures.

## Verification expectations
- Build, typecheck, lint, and unit tests must pass.

## Git
- Base branch: task/TASK-002-bootstrap-typescript
- Task branch: task/TASK-003-governed-ingestion
- Commit: aab517f

## Implementation summary
- Added front-matter validation, deterministic chunking and hashing, source approval checks, in-memory lifecycle storage, and refresh audit records.
- Updates mark prior chunks superseded; withdrawals mark active chunks withdrawn; failed parsing preserves the valid index.

## Files changed
- `src/knowledge/ingest.ts`
- `src/index.ts`
- `test/ingest.test.ts`

## Verification evidence
- `pnpm run build && pnpm run typecheck && pnpm run lint && pnpm test` — PASS (6 tests)

## Technical handover — 2026-09-27

- Delivery: complete; implementation/design commit `aab517f` is included in master and origin/master at handover baseline `35ee33e`.
- Code/evidence to read: src/knowledge/ingest.ts; test/ingest.test.ts.
- Remaining work in this original task: none; later capabilities are follow-on scope, not unfinished acceptance.
- Integration notes: This store is in-memory and serves the local Markdown demo. It is NOT the SQLite store. Preserve supersede/withdraw/failure semantics when unifying adapters; persistent withdrawal still needs implementation.
- Recheck: pnpm test (local ingestion tests).
- Cross-task resume instructions: [technical handover](../../SessionMemory/TECHNICAL-HANDOVER.md). Historical test counts above describe the original task; the current baseline is 51 passing tests.
