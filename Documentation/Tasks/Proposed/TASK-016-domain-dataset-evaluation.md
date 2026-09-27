# TASK-016 — Knowledge-to-training datasets and recorded training runs

Task Status: PROPOSED
Git Status: NOT_STARTED

## Authorization

New technical follow-on documented for handover. Not implementation approval; request owner approval before moving to Approved/.

## References and dependencies

REQ-PROD-001; REQ-FND-001; ADR-001; ADR-002 where persistent knowledge is involved.
Dependencies: TASK-012 and TASK-015; explicit approval of domain/source selection, training reuse rights and resource budget. Establish the frozen benchmark here; TASK-019 evaluates/scales model capability against it.

## Likely files

src/training/dataset.ts; datasets/; new domain manifests, evaluation runner and acceptance reports. Paths marked future are proposed, not existing code.

## Technical checklist

- [ ] Choose a narrow technology skill and define realistic held-out tasks before collecting data; record license/attribution and permitted training use for each source.
- [ ] Implement a reviewed export/normalization pipeline only for approved content; exclude secrets/personal data and keep retrieval ingestion independent from training selection.
- [ ] Split by source/project before tokenization; exact/near-duplicate and contamination review; freeze validation/test manifests and report dataset hashes.
- [ ] Benchmark memory/throughput, set resource budgets, train only within approved bounds, compare baselines and selected checkpoints; evaluate test once after selection.
- [ ] Export explicitly selected approved source/document versions into immutable training snapshots. Retain document IDs, URLs, licenses, transformation version, content hashes and exclusions. Preview and approve a manifest before scheduling training; do not automatically train on every refresh.
- [ ] Implement persisted queued/running/completed/failed/cancelled training-run records with run ID, approved manifest/config hashes, seed, Node version, resource budget, metrics, stop reason and checkpoint file/hash. Approve an ADR/schema for separate training metadata tables or store; never put weight arrays into knowledge tables.
- [ ] Add explicit job submission/start/cancel/resume operations with single-worker concurrency, restart recovery and complete-step checkpoint semantics. An interrupted run is not completed; training updates never select evaluation examples.
- [ ] Record how source withdrawal invalidates future exports and flags affected snapshots/checkpoints for review. Do not claim that deleting a source removes its influence from already trained weights.

## Acceptance and verification

- [ ] Exporting the same selected versions/config produces identical snapshot hashes despite later knowledge refreshes. Pending/non-training-approved/withdrawn sources are excluded; every example traces back to its source version.
- [ ] Queue an approved bounded run from an exported manifest, restart/resume it, then query its status, metrics and checkpoint hash. Test rejection, cancellation, resource failure and process-recovery paths without false success states.
- [ ] Freeze at least 20 narrow-domain explanation questions and 10 insufficient/conflicting-evidence cases, with reference evidence and a documented scoring rubric, before candidate selection. Keep final test cases separate from training and development/validation.
- [ ] Manifest validation rejects missing rights/provenance and cross-split duplication; reviewers can reproduce source-to-example lineage.
- [ ] Report frozen held-out and task-quality results separately from training loss, with error analysis and failed gates visible.
- [ ] No claim of general software-building ability based solely on synthetic patterns or in-sample loss.
- [ ] Run pnpm test, pnpm typecheck, pnpm lint and git diff --check; save task-specific acceptance evidence with exact commands/results.

## Out of scope

Entire-internet training, arbitrary copyrighted datasets, medical capability, unapproved model scaling and silent DB architecture changes.

## Goal, inputs and expected results

Input: approved versioned knowledge selections and a reviewed training budget. Output: a reproducible dataset manifest, isolated splits/frozen benchmark, auditable training job and candidate checkpoint. No automatic deployment of that checkpoint; promotion belongs to TASK-020. Dataset/run plumbing can pass while answer quality fails.

## Git and resume

Base: master. Planned branch: task/TASK-016-domain-dataset-evaluation. Commit: none. No implementation performed. First action: obtain approval, review dependencies/current code, then refine interfaces and tests before coding.

See [technical handover](../../SessionMemory/TECHNICAL-HANDOVER.md). New risks or expanded scope need their own decision/task, not silent implementation.

## Laptop-only implementation constraints

Follow [TRAINING-BUDGET.md](../../Project/TRAINING-BUDGET.md). Owner hardware/time/local-only requirements are firm; the 6 GiB RSS cap is a proposed starting safeguard, not measured safe capacity. Task implementation still requires approval.

- [ ] Implement TRAINING-BUDGET.md in job scheduling: one local worker, maximum 7,200 seconds end-to-end, proposed initial RSS ceiling 6 GiB or lower, and no cloud/remote-compute fallback. Keep shorter defaults until benchmarks justify increases.
- [ ] Add supervising-process deadline enforcement for synchronous/stalled workers; request graceful stop/checkpoint early, terminate at the ceiling if needed, and retain the previous validated checkpoint. Resumes are explicit jobs with lineage, not unlimited automatic restarts.
- [ ] Record worker RSS, system memory-pressure/swap observations, time, throughput, free disk and artifact estimates. Apply a reviewed disk reserve; include atomic-save temporary copies and rollback checkpoints in estimates.
- [ ] Test injected deadline, memory-pressure, low-disk, concurrent-job and unresponsive-worker cases. Jobs must stop/refuse safely, remain auditable and never be marked completed merely because the budget expired.
