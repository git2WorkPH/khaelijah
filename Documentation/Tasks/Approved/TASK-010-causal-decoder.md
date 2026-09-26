# TASK-010 — Causal decoder and masked next-token loss

Task Status: VERIFIED
Git Status: MERGED

Authorization: owner requested continuation after TASK-009 and standing verified master push.

## References
REQ-PROD-001; ADR-001; Architecture/TRAINABLE-MODEL.md; TASK-009.

## Scope
Assemble pre-normalized multi-head causal blocks from checked kernels, implement full backward composition, and stable masked cross-entropy. Default architecture follows TASK-008. Preserve existing demo adapter.

## Acceptance
- Deterministic per-token logits, configurable small test shapes, byte vocabulary, learned token/position embeddings.
- Causal attention excludes future positions and PAD keys; batches remain isolated.
- Full-model parameter gradients satisfy epsilon 1e-5 finite differences with absolute tolerance 1e-6 or relative tolerance 1e-4.
- PAD loss/gradients are zero; invalid masks/shapes fail; evaluation does not mutate parameters or gradients.
- Explicit cache ownership and single-use backward; full existing test suite passes.

## Out of scope
Optimizer, datasets, actual training, checkpoints, generation, and RAG replacement.

## Git
- Base: master
- Branch: task/TASK-010-causal-decoder
- Commit: 3eecb9f

## Verification
PASS: `pnpm test` (38 tests including build), `pnpm typecheck`, `pnpm lint`, `git diff --check`. Lint remains the project's compiler-check alias.

## Implementation evidence
- `src/model/trainable/decoder.ts`: learned embeddings, pre-normalized causal multi-head attention, residual feed-forward blocks, final normalization and vocabulary logits. Named parameters allocated once; default width 32, two blocks, four heads, context 64.
- Explicit backward tape composes existing kernels and accumulates shared parameters. Cache handles are model-owned and consumed once. Evaluation retains no cache and leaves gradients unchanged.
- `src/training/loss.ts`: stable masked mean NLL and gradients; null perplexity on exponent overflow; rejects invalid or empty active masks.
- `test/decoder.test.ts`: finite differences sampled across every parameter tensor, causal suffix invariance, batch isolation, batch gradient equivalence, PAD zeros, default-shape smoke test, malformed inputs, and cache ownership.
- Gradient tolerances: epsilon 1e-5, absolute error <=1e-6 or relative <=1e-4. Causality and batch comparisons use 1e-10.

## Follow-up
TASK-011: dataset manifests, split checks, AdamW, bounded trainer, and a tiny-overfit experiment. No actual training has run in TASK-010.

## Technical handover — 2026-09-27

- Delivery: complete; implementation/design commit `3eecb9f` is included in master and origin/master at handover baseline `35ee33e`.
- Code/evidence to read: src/model/trainable/decoder.ts; src/training/loss.ts; test/decoder.test.ts.
- Remaining work in this original task: none; later capabilities are follow-on scope, not unfinished acceptance.
- Integration notes: CausalDecoder.forward(batch, false) is cache-free evaluation; training cache handles are single-use/model-owned. TASK-012 generation must construct valid Batch inputs/masks and select last-position logits without mutating parameters.
- Recheck: pnpm test (decoder tests including sampled full-model finite differences).
- Cross-task resume instructions: [technical handover](../../SessionMemory/TECHNICAL-HANDOVER.md). Historical test counts above describe the original task; the current baseline is 51 passing tests.
