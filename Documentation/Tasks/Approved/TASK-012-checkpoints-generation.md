# TASK-012 — Checkpoint/resume, generation, and held-out evaluation

Task Status: VERIFIED
Git Status: CHANGES_UNCOMMITTED

## Authority and dependencies

Restored task record for the existing TASK-008 follow-on, covered by the owner's standing approval of the task sequence. TASK-013 was explicitly prioritized first and is now complete. Implementation and acceptance evidence are recorded below.

References: REQ-PROD-001, ADR-001, Architecture/TRAINABLE-MODEL.md, TASK-009–011.
Base: master at 91640dc. Branch: task/TASK-012-checkpoints-generation. Implementation commit: pending.

## Technical implementation checklist

- [x] Read decoder.ts, parameters.ts, tokenizer.ts, optimizer.ts, trainer.ts, dataset.ts and test/trainer.test.ts before editing.
- [x] Add src/training/checkpoint.ts with a versioned, bounded serialization format: architecture/tokenizer identity; parameter names, shapes and values; AdamW options, first/second moments and step; initialization/sampler RNG state; dataset version/hash, batching configuration/order/cursor; metrics and runtime version; checksum. Decide canonical checksum encoding explicitly.
- [x] Validate the entire payload before mutating a live model. Reject duplicate/missing/extra names, wrong shapes/tokenizer/schema, non-finite values, invalid integer state, negative second moments, oversized files/arrays, and dataset/batching mismatch. Weight-only evaluation loading is distinct from full resume.
- [x] Save to a unique sibling temporary file, validate it, then rename atomically on the same filesystem. Clean up only owned temporary files; preserve last known good checkpoint on failure. Test write/rename failure handling.
- [x] Add validated optimizer/model state restoration. Preserve parameter array ownership and optimizer bindings. Current next-batch rule is optimizer.step % batches.length; store/check it with data ordering rather than restarting at batch zero.
- [x] Add checkpoint hooks at complete-step boundaries, including cancellation/resource stops. Keep metrics' per-call versus cumulative step meanings explicit. Never publish partially applied or non-finite state.
- [x] Add src/model/trainable/generation.ts: greedy default, EOS/output bounds, exclude PAD/BOS, rolling context with reset positions. Optional temperature/top-k must validate settings and use persisted seeded randomness. Decode byte tokens with documented invalid UTF-8 replacement semantics.
- [x] Add an explicit CLI for save/load/resume/generate; choose and document flags/scripts during implementation (none exist yet). Preserve the unrelated existing src/app/train.ts formatting edit; work around it or reconcile without discarding it.
- [x] Run frozen synthetic train/validation/test experiments for seeds 11, 22, 33. Select checkpoints using validation only, report test once after selection, record hashes/settings/runtime/curve/stops. Never tune on test.
- [x] Save machine-readable results and a readable acceptance report under Documentation/Acceptance/. Record failures honestly; do not weaken gates to claim success.

## Acceptance and verification

- [x] Ten uninterrupted updates versus five + save/load + five match parameters AND AdamW moments within 1e-10 on the same runtime/config/data; use multiple batches so cursor errors are observable.
- [x] Greedy continuation is reproducible after load, bounded by context/output limits, and includes a learned-pattern example distinct from the prompt.
- [x] For each of seeds 11, 22, 33, selected validation NLL is at least 10% below initialization. Test results are separate; synthetic near-duplicates are not domain-generalization evidence.
- [x] Evaluation/generation leave model, gradients and optimizer state unchanged.
- [x] Corrupt/truncated/mismatched/oversized checkpoints, invalid sampler inputs, cancellation and resource stops have explicit regression tests.
- [x] pnpm test, pnpm typecheck, pnpm lint and git diff --check pass. Build runs inside pnpm test. Record exact experiment commands, not invented success.

## Boundaries and handoff

No internet training corpus, database training-run registry, SQLite RAG integration, or general application-building claims. Checkpoints are local files; the knowledge database stores retrieved documents, not trained weights. Follow-on integration is proposed separately.

After verification: review scoped diff, commit task files only, update task/session evidence, merge into master and push origin/master under standing authorization. See [technical handover](../../SessionMemory/TECHNICAL-HANDOVER.md).

## Implementation and verification evidence

- Added src/training/checkpoint.ts, src/model/trainable/generation.ts, src/app/model.ts, test/checkpoint.test.ts and the pnpm model script. Added complete-step/stop callbacks to src/training/trainer.ts.
- Checkpoints validate named shapes/values, optimizer options/moments/step, RNG states, data/batch hashes/order/cursor, runtime and metrics before constructing restored state. Canonical sorted-key JSON is SHA-256 checked. Limits: 32 MiB serialized file, 500,000 parameter elements.
- Atomic saves use unique sibling temporary files, fsync, reload validation and rename. Invalid writes/renames preserve the prior checkpoint; tests clean only their own temporary directories.
- Resume test uses three batches with a nonzero cursor at step five; ten uninterrupted updates and five/save/load/five match exactly for weights and moments.
- Generation supports greedy and seeded temperature/top-k, rolling context, EOS/token bounds and byte decoding. Model parameters/gradients/optimizer remain read-only; only sampling RNG advances.
- CLI: pnpm model train/resume/generate/experiment. Checkpoints are ignored local data. src/app/train.ts and src/app/knowledge.ts have unrelated user-owned formatting edits and are excluded.
- PASS: pnpm test (56 tests including build), pnpm typecheck, pnpm lint, pnpm evaluate, git diff --check. Lint is compiler-based.
- PASS: three-seed frozen held-out experiment; validation 6.148089→0.260527 (11), 5.938201→0.296939 (22), 5.434816→0.335994 (33). Every selected loaded model reproduced the fixed learned-pattern continuation.
- Acceptance: [readable report](../../Acceptance/TASK-012-checkpoints-generation.md) and [exact experiment JSON](../../Acceptance/TASK-012-experiment.json), including CLI smoke commands and results.

## Follow-up and limits

No outstanding acceptance failure. Synthetic near-duplicate splits do not prove useful application-building or real-domain generalization. The template RAG demo is unchanged. TASK-014 persistent RAG remains PROPOSED and requires approval. No training-run database or internet training corpus was added.
