# JC Model

TypeScript-only experimental knowledge retrieval and read-only planning pipeline.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm demo "Plan request input validation for a TypeScript API"
pnpm evaluate
```

The local demonstration uses synthetic, internally authored technology passages. Their `example.invalid` URLs identify fixtures, not independently verified internet sources. It performs no network retrieval or application modifications.

The model implements a small encoder with positional embeddings, Q/K/V attention, residual normalization, and a two-layer feed-forward block. Its weights are fixed and untrained, and its recommendation is a template. Passing the pipeline tests does not demonstrate learned application-building ability. Model training, semantic conflict detection, independent domain review of the 12-document synthetic corpus, and continuous internet refresh remain outstanding.

`pnpm evaluate` prints each fixture's response, retrieval scores, provenance and citation checks. Citation validity checks identity, not semantic truth. The current `lint` script runs TypeScript checks and is not a separate style linter.

The separate `src/model/trainable/decoder.ts` now provides a causal decoder with full backward composition, backed by the byte tokenizer and parameter registry. `src/training/loss.ts` implements masked next-token cross-entropy. These components are gradient-checked but have not been trained or connected to the demo adapter; the optimizer and training loop follow in TASK-011.
