# TASK-007 — Implement the read-only agent and evaluation suite

Task Status: APPROVED
Git Status: NOT_STARTED

## Requirement
- REQ-PROD-001
- REQ-FND-001

## Architecture decisions
- ADR-001

## Objective
Expose the vertical slice through a read-only planning agent and measure retrieval, provenance, citation, and insufficiency behavior with the required fixtures.

## Scope
- Request framing, orchestration, action logs, five technology fixtures, metrics, and a local CLI demonstration.

## Out of scope
- Filesystem write, shell, git, network, credential, or deployment actions.

## Acceptance criteria
- [ ] All five required fixture categories execute.
- [ ] Evaluation reports retrieval and grounding metrics.
- [ ] The agent has no write-capable tools and emits a reviewable plan only.

## Verification expectations
- Build, typecheck, lint, unit tests, integration tests, and manual CLI validation must pass.

## Git
- Base branch: task/TASK-006-grounded-rag
- Task branch: NOT_CREATED
- Commit: NOT_COMMITTED
