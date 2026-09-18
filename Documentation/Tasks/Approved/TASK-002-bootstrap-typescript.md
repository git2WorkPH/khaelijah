# TASK-002 — Bootstrap strict TypeScript project and shared contracts

Task Status: APPROVED
Git Status: NOT_STARTED

## Requirement
- REQ-PROD-001
- REQ-FND-001

## Architecture decisions
- ADR-001

## Objective
Create the dependency-free TypeScript foundation, shared domain contracts, and contract tests required by the grounded vertical slice.

## Scope
- Strict TypeScript build, test, lint, and package scripts.
- Core identifiers, lifecycle, provenance, retrieval, evidence, inference, and response contracts.
- Tests that exercise contract-safe construction and validation helpers.

## Out of scope
- Corpus ingestion, retrieval ranking, Transformer computation, RAG orchestration, or agent execution.

## Acceptance criteria
- [ ] `npm run build`, `npm run typecheck`, `npm run lint`, and `npm test` execute locally.
- [ ] The public contracts preserve the information defined by the vertical-slice design.
- [ ] Contract tests cover invalid lifecycle and citation-safe response validation inputs.

## Verification expectations
- Build, typecheck, lint, and unit tests must pass.

## Git
- Base branch: master
- Task branch: NOT_CREATED
- Commit: NOT_COMMITTED

