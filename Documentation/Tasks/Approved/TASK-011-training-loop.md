# TASK-011 — Local dataset and bounded training

Task Status: VERIFIED
Git Status: MERGED

Owner authorized TASK-011; verified work merges and pushes to master.
References: TASK-008 training design, TASK-010 decoder, REQ-PROD-001, ADR-001.

Scope: original local synthetic fixture, SHA-256 manifest validation, isolated splits, shifted/padded batches, AdamW with clipping, bounded training and tiny-overfit experiment. No database, downloads, checkpoints, or generation (TASK-012).

Acceptance: reject invalid metadata/hash and cross-split duplicates; deterministic batches; finite atomic optimizer updates; explicit step/time/RSS/cancellation stops; training NLL decreases at least 50% within 500 steps; no-update control stable; attention and feed-forward weights change; existing tests pass.

Base: master. Branch: task/TASK-011-training-loop.

Implementation commit: 5a14c6f.

Verification: `pnpm test` (44 tests including build), `pnpm typecheck`, `pnpm lint` PASS. Default decoder (44,355 parameters, seed 11) trained 200 steps: NLL 6.1749793357 to 0.01249047425; unchanged no-update control, attention and feed-forward updates confirmed. Full experiment evidence is in Documentation/Acceptance/TASK-011-experiment.json.

Implementation: src/training/{dataset,optimizer,trainer}.ts; src/app/train.ts; datasets/synthetic-pattern-v1.json; test/trainer.test.ts; package script and README. All data is original synthetic text. No database or checkpoints; those remain separate follow-on decisions/work.
