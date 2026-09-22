# Project Session Context

## Phase
PROTOTYPE — local retrieval/encoder/agent demonstration verified on 2026-09-22.

## Active requirement
REQ-PROD-001; REQ-FND-001

## Active task
TASK-009 verified: byte tokenizer, parameter registry, and numerical kernels. Commit/merge/push closeout pending.

## Recent decisions
- ADR-001: separate durable learned model capability from the refreshable knowledge layer.
- TASK-001: first grounded vertical-slice design completed and verified.
- TASK-002 through TASK-007 are explicitly approved. The owner subsequently authorized merging each completed branch into master and pushing verified master to origin. Use pnpm.

## Open findings
- Fixed, untrained encoder weights and a templated recommendation do not demonstrate learned application-building ability.
- Semantic conflict detection, real-domain evaluation, model training, and internet refresh remain outstanding. The local corpus is synthetic.

## Completed/verified work
- Established project vision, scope, glossary, architecture boundary, requirements, decision record, and proposed first planning task.
- Completed and verified TASK-001 design deliverable.
- TASK-002 through TASK-006 merged locally; TASK-007 runnable prototype passes 15 tests. See Acceptance/ACC-TASK-007.md.

## Repository state
- Base branch: master.
- Current branch: master.
- Latest design commit: c81cca7 (TASK-008); inspect git log for the closeout and merge commits.
- Working tree: clean at TASK-008 start; user scope changes were already committed in 1091899. Preserve that commit.
- Remote sync: UNKNOWN

## Current implementation state
- Last completed step: Verify CLI integration, 12 synthetic documents, all five fixtures, and stale-evidence regression.
- Last verification command: `pnpm run build && pnpm run typecheck && pnpm run lint && pnpm test`.
- Verification result: PASS.

## Resume instructions
- Next exact action: Confirm TASK-009 synchronization, then continue with TASK-010 causal decoder and masked loss when authorized.
- Files likely involved: TASK-007 record, Acceptance/ACC-TASK-007.md, README.md.
- Do not modify: Do not add external model services, live internet access, or write-capable agent tools.

## Next recommended action
TASK-010: causal decoder and masked cross-entropy. TASK-009 kernels pass finite differences for every operation; 30 tests pass overall. No trainer has been implemented or run. Standing owner instruction: merge and push each completed task to master after verification.

## Important constraints
- TypeScript-only product runtime.
- Never treat the entire internet as the training corpus or current source of truth.
- Preserve retrieval provenance and source governance.
- Medical capability requires a dedicated safety and governance scope before any implementation.

Session memory summarizes authoritative documents; it does not override them.
