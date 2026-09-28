# TASK-016 — Knowledge-to-training datasets and recorded training runs

Task Status: VERIFIED
Git Status: MERGED

## Authorization

Owner approved implementation of TASK-015–020. Source-specific rights reviews and task safety/quality gates still apply.

## Domain decision and resume boundary — 2026-09-27

The owner selected **application architecture**, explicitly declining SQLite-backed local application storage as the first training domain. Proposed initial scope: application boundaries, dependency direction, persistence and deployment trade-offs. Start with original project-authored examples and separate development/validation/final-test projects; existing internet sources remain retrieval-only unless training rights are explicitly reviewed. Do not import the existing RAG corpus as training data by implication.

Historical pause on 2026-09-27 saved memory at 0% remaining, before implementation. Work resumed 2026-09-28 after the window reset; no reset credit was consumed. Owner then explicitly approved the frozen original corpus/benchmark and short supervised baseline. Implementation and verification below supersede that pause.

Resume: read session memory and technical handover, inspect Git, create/resume task/TASK-016-domain-dataset-evaluation from master, then define the frozen architecture benchmark before authoring training examples. Record an ADR for a separate local SQLite training metadata store with checkpoint weights in files. Implement reviewed immutable source-version snapshots and explicit bounded job lifecycle; use deterministic injected resource/failure tests before any short local profiling run. Domain selection is settled; do not ask again which technology domain to use.

## References and dependencies

REQ-PROD-001; REQ-FND-001; ADR-001; ADR-002 where persistent knowledge is involved.
Dependencies: TASK-012 and TASK-015; explicit approval of domain/source selection, training reuse rights and resource budget. Establish the frozen benchmark here; TASK-019 evaluates/scales model capability against it.

## Likely files

src/training/dataset.ts; datasets/; new domain manifests, evaluation runner and acceptance reports. Paths marked future are proposed, not existing code.

## Technical checklist

- [x] Choose a narrow technology skill and define realistic held-out tasks before collecting data; record license/attribution and permitted training use for each source.
- [x] Implement a reviewed export/normalization pipeline only for approved content; exclude secrets/personal data and keep retrieval ingestion independent from training selection.
- [x] Split by source/project before tokenization; exact/near-duplicate and contamination review; freeze validation/test manifests and report dataset hashes.
- [x] Benchmark memory/throughput, set resource budgets, train only within approved bounds, compare baselines and selected checkpoints; evaluate test once after selection.
- [x] Export explicitly selected approved source/document versions into immutable training snapshots. Retain document IDs, URLs, licenses, transformation version, content hashes and exclusions. Preview and approve a manifest before scheduling training; do not automatically train on every refresh.
- [x] Implement persisted queued/running/completed/failed/cancelled training-run records with run ID, approved manifest/config hashes, seed, Node version, resource budget, metrics, stop reason and checkpoint file/hash. Approve an ADR/schema for separate training metadata tables or store; never put weight arrays into knowledge tables.
- [x] Add explicit job submission/start/cancel/resume operations with single-worker concurrency, restart recovery and complete-step checkpoint semantics. An interrupted run is not completed; training updates never select evaluation examples.
- [x] Record how source withdrawal invalidates future exports and flags affected snapshots/checkpoints for review. Do not claim that deleting a source removes its influence from already trained weights.

## Acceptance and verification

- [x] Exporting the same selected versions/config produces identical snapshot hashes despite later knowledge refreshes. Pending/non-training-approved/withdrawn sources are excluded; every example traces back to its source version.
- [x] Queue an approved bounded run from an exported manifest, restart/resume it, then query its status, metrics and checkpoint hash. Test rejection, cancellation, resource failure and process-recovery paths without false success states.
- [x] Freeze at least 20 narrow-domain explanation questions and 10 insufficient/conflicting-evidence cases, with reference evidence and a documented scoring rubric, before candidate selection. Keep final test cases separate from training and development/validation.
- [x] Manifest validation rejects missing rights/provenance and cross-split duplication; reviewers can reproduce source-to-example lineage.
- [x] Report frozen held-out and task-quality results separately from training loss, with error analysis and failed gates visible.
- [x] No claim of general software-building ability based solely on synthetic patterns or in-sample loss.
- [x] Run pnpm test, pnpm typecheck, pnpm lint and git diff --check; save task-specific acceptance evidence with exact commands/results.

## Out of scope

Entire-internet training, arbitrary copyrighted datasets, medical capability, unapproved model scaling and silent DB architecture changes.

## Goal, inputs and expected results

Input: approved versioned knowledge selections and a reviewed training budget. Output: a reproducible dataset manifest, isolated splits/frozen benchmark, auditable training job and candidate checkpoint. No automatic deployment of that checkpoint; promotion belongs to TASK-020. Dataset/run plumbing can pass while answer quality fails.

## Git and resume

Base: master b88e512. Branch: task/TASK-016-domain-dataset-evaluation. Implementation d179f28; merge 653e4d6 successfully pushed to origin/master. Preserve unrelated user formatting in src/app/train.ts and src/app/knowledge.ts. Next approved task: TASK-019.

See [technical handover](../../SessionMemory/TECHNICAL-HANDOVER.md). New risks or expanded scope need their own decision/task, not silent implementation.

## Laptop-only implementation constraints

Follow [TRAINING-BUDGET.md](../../Project/TRAINING-BUDGET.md). Owner hardware/time/local-only requirements are firm; the 6 GiB RSS cap is a proposed starting safeguard, not measured safe capacity. Implementation is approved; resource and quality gates still apply.

- [x] Implement TRAINING-BUDGET.md in job scheduling: one local worker, maximum 7,200 seconds end-to-end, proposed initial RSS ceiling 6 GiB or lower, and no cloud/remote-compute fallback. Keep shorter defaults until benchmarks justify increases.
- [x] Add supervising-process deadline enforcement for synchronous/stalled workers; request graceful stop/checkpoint early, terminate at the ceiling if needed, and retain the previous validated checkpoint. Resumes are explicit jobs with lineage, not unlimited automatic restarts.
- [x] Record worker RSS, system memory-pressure/swap observations, time, throughput, free disk and artifact estimates. Apply a reviewed disk reserve; include atomic-save temporary copies and rollback checkpoints in estimates.
- [x] Test injected deadline, memory-pressure, low-disk, concurrent-job and unresponsive-worker cases. Jobs must stop/refuse safely, remain auditable and never be marked completed merely because the budget expired.

## Owner authorization — current

Owner explicitly approved implementation of TASK-015–020 in conversation. This supersedes historical proposed/approval-pending wording above, but not source-specific reuse reviews, capability gates, resource ceilings or workspace-action safety boundaries. TASK-015 is delivered. Remaining order: 016 → 019 → 020 → 017 → 018. TASK-016 is delivered for application architecture; TASK-019 is next.

## Implementation and acceptance evidence

See [ADR-004](../../Architecture/Decisions/ADR-004-training-registry.md), [operator guide](../../Training/JOBS.md), [acceptance report](../../Acceptance/TASK-016-domain-dataset-evaluation.md) and [baseline JSON](../../Acceptance/TASK-016-baseline.json). New files: app/jobs.ts; training/{snapshot,registry,job-policy,resource-monitor,supervisor,job-worker}.ts; three architecture dataset/review JSON files; training-jobs tests and subprocess fixtures. Existing numerical/trainer/checkpoint implementations are unchanged.

Verification: pnpm test (84 including build), pnpm typecheck, pnpm lint and git diff --check PASS. Live ten-step owner-approved baseline completed in 819 ms at 265060352 bytes peak worker RSS; validation NLL 5.8573883255909935 → 4.625060627977373. Selected final checkpoint's one-time loss-test NLL is 4.6412598024329945 with zero updates. The 30-case architecture-answer rubric is frozen but unscored: task-quality/promotion gates are explicitly not established, not passed by lower loss. Subjective laptop responsiveness and larger-run capacity remain unmeasured. The approved TASK-019 owns capability scoring and any reviewed data/model expansion.

Resource/failure tests cover bounded configs, low disk, memory pressure, unavailable monitoring, cancellation, concurrent claims, stale-process recovery, stalled child termination, missing results and corrupt resume identity. Privacy/contamination detection is heuristic plus explicit review. One-worker enforcement is per supported checkout registry; do not run legacy/other-checkout trainers concurrently. Historical versions/checkpoints are retained, not silently purged. No external source was granted training rights and no cloud service was used.
