# TASK-001 — Design the first grounded vertical slice

Task Status: VERIFIED
Git Status: NOT_STARTED

## Requirement

- REQ-PROD-001
- REQ-FND-001

## Related findings

- FIND-001 (repository contains documentation templates only)

## Architecture decisions

- ADR-001

## Objective

Produce an implementation-ready technical design for a small, local technology-profile flow: a developer asks one application-building question; the system retrieves from a governed local corpus; the custom Transformer inference boundary receives selected evidence; and the system emits a sourced implementation plan and evaluation record.

## Scope

- Define module boundaries, TypeScript interfaces, data contracts, and failure behavior.
- Select an initial local corpus format and a minimal retrieval approach.
- Define the minimum viable Transformer inference contract without assuming a completed trained model.
- Define evaluation fixtures, metrics, and representative developer prompts.
- List implementation tasks in dependency order.

## Out of scope

- Implementing the vertical slice.
- Choosing or integrating live internet connectors.
- Medical knowledge profiles.
- Autonomous filesystem, shell, git, or deployment actions.

## Acceptance criteria

- [x] The design identifies concrete TypeScript module boundaries and public interfaces.
- [x] It specifies provenance, lifecycle, and retrieval-result data contracts.
- [x] It defines a testable local demonstration corpus and at least five evaluation prompts.
- [x] It describes how a missing, irrelevant, or conflicting retrieval result is represented to the user.
- [x] It divides implementation into independently verifiable follow-on tasks.

## Verification expectations

- Build: Not applicable; planning task.
- Typecheck: Not applicable; planning task.
- Lint: Not applicable; planning task.
- Unit tests: Not applicable; planning task.
- Integration tests: Not applicable; planning task.
- Manual validation: Completed against REQ-PROD-001, REQ-FND-001, and ADR-001.

## Git

- Base branch: Unknown (Git metadata unavailable).
- Task branch: NOT_CREATED
- Commit: NOT_COMMITTED
- Remote state: NOT_PUSHED
- Merge state: NOT_MERGED

## Implementation summary

Created `Documentation/Architecture/FIRST-GROUNDED-VERTICAL-SLICE.md`, defining the local technology-profile workflow, contracts, lifecycle, provenance, failure behavior, evaluation, and ordered follow-on work.

## Files changed

- `Documentation/Architecture/FIRST-GROUNDED-VERTICAL-SLICE.md`
- `Documentation/Tasks/Approved/TASK-001-first-grounded-vertical-slice.md`

## Verification evidence

- Commands: Cross-reference and placeholder scan of governed documentation.
- Result: PASS — requirements, decision, task, and design references are consistent; TASK-001 acceptance criteria are satisfied by the design.
- Acceptance evidence: This task record.

## Follow-ups

- Propose TASK-002 before creating product source code.
