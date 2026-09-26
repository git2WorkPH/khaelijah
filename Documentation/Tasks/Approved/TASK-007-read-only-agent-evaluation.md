# TASK-007 — Implement the read-only agent and evaluation suite

Task Status: VERIFIED
Git Status: MERGED

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
- [x] All five required fixture categories execute.
- [x] Evaluation reports retrieval and grounding metrics.
- [x] The agent has no write-capable tools and emits a reviewable plan only.

## Verification expectations
- Build, typecheck, lint, unit tests, integration tests, and manual CLI validation must pass.

## Git
- Base branch: master
- Task branch: task/TASK-007-read-only-agent-evaluation
- Commit: 6c409ca

## Implementation and verification

Read-only orchestration, local CLI, 12 synthetic Markdown documents, five fixtures, and retrieval/citation/provenance metrics implemented. Integration review also corrected stale-evidence validation and completed the encoder's projections, positional inputs, normalization, and feed-forward block.

Evidence: `Documentation/Acceptance/ACC-TASK-007.md`. All 15 tests, build, typecheck, compiler-based lint, and CLI evaluation pass. Verification applies to the prototype pipeline, not trained-model quality.

## Technical handover — 2026-09-27

- Delivery: complete; implementation/design commit `6c409ca` is included in master and origin/master at handover baseline `35ee33e`.
- Code/evidence to read: src/agent/planning-agent.ts; src/evaluation/; src/app/{cli,demo}.ts; test/evaluation.test.ts; Documentation/Acceptance/ACC-TASK-007.md.
- Remaining work in this original task: none; later capabilities are follow-on scope, not unfinished acceptance.
- Integration notes: Five fixture categories and 12 synthetic documents evaluate plumbing, not real-domain usefulness. Keep tools read-only; application file edits/execution need a separately approved safety design and tests.
- Recheck: pnpm test; pnpm evaluate; pnpm demo.
- Cross-task resume instructions: [technical handover](../../SessionMemory/TECHNICAL-HANDOVER.md). Historical test counts above describe the original task; the current baseline is 51 passing tests.
