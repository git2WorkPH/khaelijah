# TASK-002 — Bootstrap strict TypeScript project and shared contracts

Task Status: VERIFIED
Git Status: MERGED

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
- [x] `pnpm build`, `pnpm typecheck`, `pnpm lint`, and `pnpm test` execute locally.
- [x] The public contracts preserve the information defined by the vertical-slice design.
- [x] Contract tests cover invalid lifecycle and citation-safe response validation inputs.

## Verification expectations
- Build, typecheck, lint, and unit tests must pass.

## Git
- Base branch: master
- Task branch: task/TASK-002-bootstrap-typescript
- Commit: bb1d971

## Implementation summary
- Added a strict, dependency-light TypeScript project using pnpm.
- Added shared contracts for profiles, source provenance, chunks, retrieval, evidence, inference, grounded responses, and citations.
- Added response validation that rejects citations absent from the evidence packet.

## Files changed
- `.gitignore`
- `package.json`
- `pnpm-lock.yaml`
- `tsconfig.json`
- `src/core/contracts.ts`
- `src/core/result.ts`
- `src/index.ts`
- `test/contracts.test.ts`

## Verification evidence
- `pnpm run build` — PASS
- `pnpm run typecheck` — PASS
- `pnpm run lint` — PASS
- `pnpm test` — PASS (3 tests)

## Technical handover — 2026-09-27

- Delivery: complete; implementation/design commit `bb1d971` is included in master and origin/master at handover baseline `35ee33e`.
- Code/evidence to read: src/core/contracts.ts; src/core/result.ts; package.json; test/contracts.test.ts.
- Remaining work in this original task: none; later capabilities are follow-on scope, not unfinished acceptance.
- Integration notes: Keep strict TypeScript, pnpm, and citation validation. The existing RetrievalPort is asynchronous, but GroundedPlanner currently depends on concrete LexicalRetriever; bridging that mismatch is future integration work.
- Recheck: pnpm test; pnpm typecheck; pnpm lint.
- Cross-task resume instructions: [technical handover](../../SessionMemory/TECHNICAL-HANDOVER.md). Historical test counts above describe the original task; the current baseline is 51 passing tests.
