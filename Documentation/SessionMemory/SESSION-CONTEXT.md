# Project Session Context

## Current milestone

TASK-012 implementation is VERIFIED on task/TASK-012-checkpoints-generation, based on master 91640dc. Commit/merge/push closeout is pending at this snapshot. TASK-001–013 are now verified; TASK-014–018 remain PROPOSED and need approval.

Read [technical handover](TECHNICAL-HANDOVER.md), [TASK-012](../Tasks/Approved/TASK-012-checkpoints-generation.md), and [acceptance report](../Acceptance/TASK-012-checkpoints-generation.md). Do not restart completed work.

## Implementation

- src/training/checkpoint.ts: bounded versioned/checksummed files, named weights, optimizer/moments/step, RNG, manifest/batch hashes/order/cursor, runtime and metrics. Atomic validated sibling-temp saves; evaluation-only versus full-resume restore.
- src/model/trainable/generation.ts: bounded greedy or seeded temperature/top-k, rolling context, EOS and byte decoding.
- src/training/trainer.ts: complete-step and stop callbacks.
- src/app/model.ts: separate train/resume/generate/experiment CLI; legacy train:toy and RAG demo stay unchanged.
- Checkpoints are ignored local data, not part of Git pushes. SQLite still stores knowledge only; internet retrieval is not automatically training data or wired to the model.

## Verification

PASS: pnpm test (56 tests including build), pnpm typecheck, pnpm lint (compiler alias), pnpm evaluate and git diff --check.
PASS: pnpm model experiment data/task012 Documentation/Acceptance/TASK-012-experiment.json.
Seeds 11/22/33 selected validation NLL: 0.260527/0.296939/0.335994, each >10% improvement. Synthetic near-duplicate patterns only; no claim of application-building quality.
PASS: five-step CLI training plus five-step resume reaches cumulative step 10; generation from seed-11 checkpoint returns repeating pattern with EOS.
Regression: ten updates versus five/disk-save/load/five match exactly, including moments, using a nonzero cursor among three batches; corrupt files/I/O failures/resource stops/read-only inference are tested.
No known running processes at handoff.

## Git and preservation

Base: master. Current task branch: task/TASK-012-checkpoints-generation. Implementation commit pending; inspect git log/status for subsequent closeout.
Preserve and EXCLUDE user formatting changes in src/app/train.ts and src/app/knowledge.ts. The latter appeared during this task and was inspected as formatting-only. No task implementation depends on either edit.
Standing authorization: merge completed verified tasks into master and push origin/master; no unrelated commits, destructive resets or force-pushes.

## Next exact action

Review scoped diff, commit TASK-012 files only, record its hash, merge master, push and verify synchronization. Then request approval for TASK-014 persistent RAG before implementation. TASK-014–018 are not approved by earlier blanket authorization.

## Reproduce

Use Node >=22.16, pnpm and TypeScript-only runtime. Same Node version/config/data are required for exact resume.
- pnpm model train data/pattern.json 200 11
- pnpm model resume data/pattern.json 25
- pnpm model generate data/pattern.json "abc "
- pnpm model experiment data/task012 Documentation/Acceptance/TASK-012-experiment.json

CLI saves every 25 cumulative updates and on normal/resource/cancellation stops. A forced kill is not a graceful checkpoint. Back up ignored local checkpoint/database files separately. Public accessibility is not reuse permission; medical and workspace-write capabilities need separate approved safety scope.

Update task/session memory at meaningful boundaries and at 2% remaining usage. Latest usage check during TASK-012 showed 24% remaining in the five-hour window, 88% weekly; no reset consumed and no unattended monitor installed. Historical memory snapshots do not override current tasks, Git state or evidence.
