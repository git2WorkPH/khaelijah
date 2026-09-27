# TASK-020 — Evaluate, promote and roll back accepted checkpoints

Task Status: PROPOSED
Git Status: NOT_STARTED

## Goal and requirements

REQ-PROD-001; ADR-001. Prevent a completed training job from silently replacing a working model. Only explicitly accepted, traceable checkpoints become eligible for learned inference.

## Dependencies and authorization

TASK-012 checkpoint integrity, TASK-016 run registry and TASK-019 capability evidence. TASK-017 consumes the accepted-checkpoint selector. This proposal does not authorize implementation or automatically deploying models.

## Inputs and expected results

Inputs: candidate checkpoint hash, dataset/run identity, reviewed gate policy and signed-off evaluation evidence.
Output: candidate/accepted/rejected/revoked state, an auditable active model selection and rollback to a prior accepted checkpoint. Weight files remain separate from knowledge tables.

## Technical checklist

- [ ] Define versioned gate policy and candidate/evaluated/accepted/rejected/revoked lifecycle with reviewer/reason/timestamps. Store the policy and evaluation hashes with each decision.
- [ ] Validate checkpoint checksum, tokenizer/architecture/runtime compatibility, manifest/run lineage and complete evaluation evidence. Refuse missing, corrupted, failed-budget or failed-quality candidates.
- [ ] Apply the predeclared TASK-019 capability gates plus numerical/resume/resource regressions. Compare with the accepted baseline using development/validation; consume sealed-test evidence without repeatedly querying the test set to tune promotion.
- [ ] Implement explicit review/accept/reject/promote/rollback commands and an atomic active-checkpoint pointer. A failed promotion must leave the previous pointer usable.
- [ ] Pin a checkpoint hash for each inference request; pointer changes affect new requests, not an in-progress request. Handle missing/revoked active state explicitly.
- [ ] Associate source-rights withdrawals with affected manifests/checkpoints for review/revocation; do not claim trained weights can be unlearned by deleting source rows.
- [ ] Record promotion and rollback in the run registry. Keep an accepted rollback candidate and verify referenced files/hashes before switching.

## Acceptance and verification

- [ ] Failed, incomplete, corrupt, incompatible, unreviewed or revoked candidates cannot become active in tests.
- [ ] Promote a passing fixture checkpoint, simulate interrupted/failed pointer writes, restart and verify the last valid active state.
- [ ] Roll back atomically and reproduce the previous checkpoint's deterministic output; in-flight requests retain their original model identity.
- [ ] Every decision traces to run, dataset, checkpoint, evaluator/policy and review evidence. Successful training alone never implies acceptance.
- [ ] No gate threshold changes after candidate results without a recorded, approved policy revision and fresh evaluation strategy.
- [ ] Run pnpm test, pnpm typecheck, pnpm lint and git diff --check; include positive and negative promotion/recovery evidence.

## Out of scope and resume

No new training algorithm, hidden hosted-model fallback, automatic production deployment, model quality guarantee from checksum validation, or learned RAG implementation (TASK-017).
Likely files: training registry/promotion modules (future), checkpoint loader, new CLI and acceptance tests.
Base: master. Planned branch: task/TASK-020-checkpoint-promotion. Commit: none.
First action after approval: design lifecycle/pointer storage and failure tests against TASK-016's approved registry ADR.
