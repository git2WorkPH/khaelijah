# TASK-012 — Checkpoint/resume, generation, and held-out evaluation

Task Status: APPROVED
Git Status: NOT_STARTED

## Authority and dependencies

Restored task record for the existing TASK-008 follow-on, covered by the owner's standing approval of the task sequence. TASK-013 was explicitly prioritized first and is now complete. This record is a handover plan, not evidence of implementation.

References: REQ-PROD-001, ADR-001, Architecture/TRAINABLE-MODEL.md, TASK-009–011.
Base: master. Planned branch: task/TASK-012-checkpoints-generation. Commit: none.

## Technical implementation checklist

- [ ] Read decoder.ts, parameters.ts, tokenizer.ts, optimizer.ts, trainer.ts, dataset.ts and test/trainer.test.ts before editing.
- [ ] Add src/training/checkpoint.ts with a versioned, bounded serialization format: architecture/tokenizer identity; parameter names, shapes and values; AdamW options, first/second moments and step; initialization/sampler RNG state; dataset version/hash, batching configuration/order/cursor; metrics and runtime version; checksum. Decide canonical checksum encoding explicitly.
- [ ] Validate the entire payload before mutating a live model. Reject duplicate/missing/extra names, wrong shapes/tokenizer/schema, non-finite values, invalid integer state, negative second moments, oversized files/arrays, and dataset/batching mismatch. Weight-only evaluation loading is distinct from full resume.
- [ ] Save to a unique sibling temporary file, validate it, then rename atomically on the same filesystem. Clean up only owned temporary files; preserve last known good checkpoint on failure. Test write/rename failure handling.
- [ ] Add validated optimizer/model state restoration. Preserve parameter array ownership and optimizer bindings. Current next-batch rule is optimizer.step % batches.length; store/check it with data ordering rather than restarting at batch zero.
- [ ] Add checkpoint hooks at complete-step boundaries, including cancellation/resource stops. Keep metrics' per-call versus cumulative step meanings explicit. Never publish partially applied or non-finite state.
- [ ] Add src/model/trainable/generation.ts: greedy default, EOS/output bounds, exclude PAD/BOS, rolling context with reset positions. Optional temperature/top-k must validate settings and use persisted seeded randomness. Decode byte tokens with documented invalid UTF-8 replacement semantics.
- [ ] Add an explicit CLI for save/load/resume/generate; choose and document flags/scripts during implementation (none exist yet). Preserve the unrelated existing src/app/train.ts formatting edit; work around it or reconcile without discarding it.
- [ ] Run frozen synthetic train/validation/test experiments for seeds 11, 22, 33. Select checkpoints using validation only, report test once after selection, record hashes/settings/runtime/curve/stops. Never tune on test.
- [ ] Save machine-readable results and a readable acceptance report under Documentation/Acceptance/. Record failures honestly; do not weaken gates to claim success.

## Acceptance and verification

- [ ] Ten uninterrupted updates versus five + save/load + five match parameters AND AdamW moments within 1e-10 on the same runtime/config/data; use multiple batches so cursor errors are observable.
- [ ] Greedy continuation is reproducible after load, bounded by context/output limits, and includes a learned-pattern example distinct from the prompt.
- [ ] For each of seeds 11, 22, 33, selected validation NLL is at least 10% below initialization. Test results are separate; synthetic near-duplicates are not domain-generalization evidence.
- [ ] Evaluation/generation leave model, gradients and optimizer state unchanged.
- [ ] Corrupt/truncated/mismatched/oversized checkpoints, invalid sampler inputs, cancellation and resource stops have explicit regression tests.
- [ ] pnpm test, pnpm typecheck, pnpm lint and git diff --check pass. Build runs inside pnpm test. Record exact experiment commands, not invented success.

## Boundaries and handoff

No internet training corpus, database training-run registry, SQLite RAG integration, or general application-building claims. Checkpoints are local files; the knowledge database stores retrieved documents, not trained weights. Follow-on integration is proposed separately.

After verification: review scoped diff, commit task files only, update task/session evidence, merge into master and push origin/master under standing authorization. See [technical handover](../../SessionMemory/TECHNICAL-HANDOVER.md).
