# TASK-016 — Curate a licensed domain dataset and evaluation

Task Status: PROPOSED
Git Status: NOT_STARTED

## Authorization

New technical follow-on documented for handover. Not implementation approval; request owner approval before moving to Approved/.

## References and dependencies

REQ-PROD-001; REQ-FND-001; ADR-001; ADR-002 where persistent knowledge is involved.
Dependencies: TASK-012; explicit approval of source selection and training reuse rights.

## Likely files

src/training/dataset.ts; datasets/; new domain manifests, evaluation runner and acceptance reports. Paths marked future are proposed, not existing code.

## Technical checklist

- [ ] Choose a narrow technology skill and define realistic held-out tasks before collecting data; record license/attribution and permitted training use for each source.
- [ ] Implement a reviewed export/normalization pipeline only for approved content; exclude secrets/personal data and keep retrieval ingestion independent from training selection.
- [ ] Split by source/project before tokenization; exact/near-duplicate and contamination review; freeze validation/test manifests and report dataset hashes.
- [ ] Benchmark memory/throughput, set resource budgets, train only within approved bounds, compare baselines and selected checkpoints; evaluate test once after selection.
- [ ] Decide whether a training-run registry is needed; propose an ADR/schema for run ID, config, manifest/checkpoint hashes and metrics rather than storing model arrays in the knowledge tables.

## Acceptance and verification

- [ ] Manifest validation rejects missing rights/provenance and cross-split duplication; reviewers can reproduce source-to-example lineage.
- [ ] Report frozen held-out and task-quality results separately from training loss, with error analysis and failed gates visible.
- [ ] No claim of general software-building ability based solely on synthetic patterns or in-sample loss.
- [ ] Run pnpm test, pnpm typecheck, pnpm lint and git diff --check; save task-specific acceptance evidence with exact commands/results.

## Out of scope

Entire-internet training, arbitrary copyrighted datasets, medical capability, unapproved model scaling and silent DB architecture changes.

## Git and resume

Base: master. Planned branch: task/TASK-016-domain-dataset-evaluation. Commit: none. No implementation performed. First action: obtain approval, review dependencies/current code, then refine interfaces and tests before coding.

See [technical handover](../../SessionMemory/TECHNICAL-HANDOVER.md). New risks or expanded scope need their own decision/task, not silent implementation.
