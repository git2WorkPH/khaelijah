# TASK-003 — Implement governed local corpus ingestion

Task Status: APPROVED
Git Status: NOT_STARTED

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
- [ ] Valid documents ingest into traceable source and chunk records.
- [ ] Updates supersede prior chunks and withdrawals exclude chunks from active retrieval.
- [ ] Refresh results report additions, updates, withdrawals, and failures.

## Verification expectations
- Build, typecheck, lint, and unit tests must pass.

## Git
- Base branch: task/TASK-002-bootstrap-typescript
- Task branch: NOT_CREATED
- Commit: NOT_COMMITTED

