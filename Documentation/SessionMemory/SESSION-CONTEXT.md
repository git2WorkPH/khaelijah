# Project Session Context

## Phase
DEVELOPMENT — first grounded vertical slice implementation in progress.

## Active requirement
REQ-PROD-001; REQ-FND-001

## Active task
TASK-003 — Implement governed local corpus ingestion.

## Recent decisions
- ADR-001: separate durable learned model capability from the refreshable knowledge layer.
- TASK-001: first grounded vertical-slice design completed and verified.
- TASK-002 through TASK-007 are explicitly approved by the project owner; implement them one at a time using stacked local task branches, without push or merge.

## Open findings
- FIND-001: repository is documentation-only; no product code or Git metadata exists.

## Completed/verified work
- Established project vision, scope, glossary, architecture boundary, requirements, decision record, and proposed first planning task.
- Completed and verified TASK-001 design deliverable.

## Repository state
- Base branch: UNKNOWN (not a Git repository at inspection time).
- Current branch: task/TASK-003-governed-ingestion
- Latest commit: aab517f (`feat(knowledge): add governed corpus ingestion [TASK-003]`).
- Working tree: Documentation update pending final task-record commit.
- Remote sync: UNKNOWN

## Current implementation state
- Last completed step: Implement governed local corpus ingestion (TASK-003).
- Last verification command: `pnpm run build && pnpm run typecheck && pnpm run lint && pnpm test`.
- Verification result: PASS.

## Resume instructions
- Next exact action: Commit and merge TASK-003, then implement deterministic lexical retrieval in TASK-004.
- Files likely involved: `src/knowledge/retrieval.ts`, `test/`, and `Documentation/Tasks/Approved/TASK-004-lexical-retrieval.md`.
- Do not modify: Do not add external model services, live internet access, or write-capable agent tools.

## Next recommended action
Complete TASK-002, then proceed to TASK-003 on its stacked local branch.

## Important constraints
- TypeScript-only product runtime.
- Never treat the entire internet as the training corpus or current source of truth.
- Preserve retrieval provenance and source governance.
- Medical capability requires a dedicated safety and governance scope before any implementation.

Session memory summarizes authoritative documents; it does not override them.
