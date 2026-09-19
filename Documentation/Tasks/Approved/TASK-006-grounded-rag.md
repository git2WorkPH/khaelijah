# TASK-006 — Implement grounded RAG response assembly

Task Status: VERIFIED
Git Status: CHANGES_UNCOMMITTED

## Requirement
- REQ-PROD-001

## Architecture decisions
- ADR-001

## Objective
Build evidence packets, invoke the custom inference boundary, validate citations, and return sourced plans or explicit insufficiency states.

## Scope
- Evidence packet construction, response schema validation, provenance rendering, stale-evidence detection, and insufficient-evidence behavior.

## Out of scope
- Live source refresh, multi-profile routing, and agent workspace actions.

## Acceptance criteria
- [ ] Every returned citation maps to an evidence-packet passage.
- [ ] Unknown citations are rejected.
- [ ] Insufficient and stale evidence result in explicit non-plan states.

## Verification expectations
- Build, typecheck, lint, and unit tests must pass.

## Git
- Base branch: task/TASK-005-custom-transformer
- Task branch: task/TASK-006-grounded-rag
- Commit: NOT_COMMITTED

## Implementation summary
- Added evidence-packet construction, inference invocation, citation validation, and explicit insufficient, stale, and invalid-citation responses.

## Verification evidence
- `pnpm run build && pnpm run typecheck && pnpm run lint && pnpm test` — PASS (13 tests)
