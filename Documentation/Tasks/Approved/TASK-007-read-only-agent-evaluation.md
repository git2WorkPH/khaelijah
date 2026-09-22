# TASK-007 — Implement the read-only agent and evaluation suite

Task Status: VERIFIED
Git Status: CHANGES_UNCOMMITTED

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
- Base branch: master
- Task branch: task/TASK-007-read-only-agent-evaluation
- Commit: NOT_COMMITTED

## Implementation and verification

Read-only orchestration, local CLI, 12 synthetic Markdown documents, five fixtures, and retrieval/citation/provenance metrics implemented. Integration review also corrected stale-evidence validation and completed the encoder's projections, positional inputs, normalization, and feed-forward block.

Evidence: `Documentation/Acceptance/ACC-TASK-007.md`. All 15 tests, build, typecheck, compiler-based lint, and CLI evaluation pass. Verification applies to the prototype pipeline, not trained-model quality.
