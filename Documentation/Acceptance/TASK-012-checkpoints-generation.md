# TASK-012 acceptance — 2026-09-27

## Results

| Seed | Initial validation NLL | Selected validation NLL | Test NLL | Selected step |
| --- | --- | --- | --- | --- |
| 11 | 6.148089 | 0.260527 | 0.283217 | 125 |
| 22 | 5.938201 | 0.296939 | 0.271685 | 100 |
| 33 | 5.434816 | 0.335994 | 0.477360 | 100 |

All seeds completed 200 updates within resource bounds. Validation was checked every 25 updates, and minimum validation NLL selected the checkpoint. Each selected checkpoint passed the >=10% improvement gate. Test was measured once after selection, never used for selection. Frozen manifest: datasets/synthetic-pattern-v1.json. Exact hashes, configuration, runtime, per-step curves, stop reasons and checkpoint hashes are in [machine-readable report](TASK-012-experiment.json).

All loaded selected checkpoints reproduced the fixed 12-byte continuation `abc abc abc ` from prompt `abc ` and left weights/optimizer state unchanged during evaluation/generation. This proves synthetic pattern learning only: splits are near-duplicates from one original fixture family, not real-world generalization.

## Verification commands and outcomes

- `pnpm model experiment data/task012 Documentation/Acceptance/TASK-012-experiment.json` — PASS, three seeds, all gates true.
- `pnpm model train data/task012-cli.json 5 11` — PASS, checkpoint at cumulative step 5.
- `pnpm model resume data/task012-cli.json 5` — PASS, checkpoint at cumulative step 10, five additional updates.
- `pnpm model generate data/task012/seed-11.json "abc "` — PASS, repeating-pattern continuation, EOS stop.
- `pnpm test` — PASS, 56 tests including build.
- `pnpm typecheck`, `pnpm lint`, `pnpm evaluate`, `git diff --check` — PASS; lint is compiler-based.

## Regression coverage

test/checkpoint.test.ts checks exact equality (stronger than 1e-10 tolerance) for ten uninterrupted updates versus five/save-to-disk/load/five, using three batches so resuming after step five must start at a nonzero cursor. Parameter arrays, optimizer moments and initialization RNG state match. Resume validates manifest and batching hashes, order/cursor, runtime, tokenizer and schema.

Malformed/truncated/checksum-invalid payloads, missing/duplicate parameter names, mismatched shapes, non-finite and sparse arrays, negative second moments, invalid optimizer options/RNG state/cursor/metrics, dataset mismatch and oversized files are rejected. Full training state is required for resume; weight-only state loads for evaluation.

Injected write/rename failures and invalid snapshot saves preserve the prior checkpoint and clean only owned temporary files. Complete-step hooks persist cancellation/time/RSS stops. Failed numerical updates do not invoke publication hooks. Generation tests cover deterministic reload, persisted sampling RNG state, invalid settings, context/output bounds, EOS, exclusion of special output IDs, and read-only model/gradient/optimizer state.

## Artifact/recovery notes

Experiment checkpoints are local ignored files under data/task012; the report is committed, weights are not. Reproduce with the experiment command above. CLI checkpoints save every 25 steps and on explicit resource/cancellation/normal stops, not on process crashes or forced kills. Atomic rename protects the previous checkpoint against tested write failures; this is not a claim of full power-loss durability across all filesystems. New checkpoints use restrictive file permissions. No database stores training runs or parameters.
