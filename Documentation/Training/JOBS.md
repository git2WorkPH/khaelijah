# Architecture datasets and local jobs (TASK-016)

The model now has a governed path from selected document versions to a reviewed dataset and a recorded training attempt. Ingestion remains separate: fetching a website does not train or promote a model. The first corpus is **original application-architecture material**, not downloaded third-party text. Current knowledge prompts still use source-backed templates.

## What to read

1. [TASK-016](../Tasks/Approved/TASK-016-domain-dataset-evaluation.md): requirements, goals and expected results.
2. [ADR-004](../Architecture/Decisions/ADR-004-training-registry.md): storage and supervision design.
3. This guide: commands and operational limits.
4. [Acceptance report](../Acceptance/TASK-016-domain-dataset-evaluation.md) and [baseline evidence](../Acceptance/TASK-016-baseline.json): what actually ran and what remains unproven.

## Freeze, preview, approve, submit, start

Run from the checkout root using Node >=22.16 and pnpm. Production resource monitoring currently requires macOS and permission to read `ps` and `sysctl`. Tests inject observations; the production CLI does not provide a monitoring bypass. One supported registry per checkout is fixed at `data/training/registry.sqlite`; artifacts are in `data/training/<run-id>/`. These local data are ignored by Git.

```sh
pnpm jobs freeze datasets/architecture-benchmark-v1.json datasets/architecture-review-v1.json
pnpm jobs original datasets/architecture-original-v1.json BENCHMARK_HASH
pnpm jobs snapshot SNAPSHOT_HASH
pnpm jobs approve SNAPSHOT_HASH datasets/architecture-review-v1.json
pnpm jobs submit SNAPSHOT_HASH
pnpm jobs start RUN_ID
pnpm jobs status RUN_ID
```

Replace uppercase values with command outputs. Submission queues only; start runs one explicitly selected job in the foreground. Review the preview before approving its exact hash. For a different corpus, write a truthful new review file: reviewer, reason, reviewedAt and explicit `rights`, `privacy`, `contamination` booleans all true. The supplied review applies only to the owner-approved original architecture corpus/benchmark and short baseline, not arbitrary future data. Its timestamp records the review date normalized to midnight, not exact conversation time.

Current benchmark hash: `197bef45aabec89de045aba42def0fa2ea19e28d1d293ffa8cef23d172e47127`.
Current original snapshot hash: `5d2be92603e799d8a42e8f6ba46bcfa3a728154c2c7d92bb2f582c5f461e7fa1`.

The frozen benchmark has 20 explanation cases and 10 insufficient/conflicting-evidence cases, with original reference evidence and a 0–2 correctness/trade-off/actionability rubric. The training corpus has four train, two validation and two loss-test documents, all distinct project/source groups. These loss splits are separate from the 30 task-quality cases. Freeze precedes training. JSON content hashes, not filenames, identify snapshots. Snapshot bodies and approvals are immutable through the supported interface. Human review is still needed: automatic exact/near-duplicate and sensitive-marker checks are heuristics, not complete semantic contamination or privacy detection.

## Export training-approved knowledge versions

Only sources explicitly reviewed for **training**, as well as retrieval, qualify. The initial SQLite internet registration is still retrieval-only. Use the source-review workflow to record truthful permission; do not set trainingAllowed merely because a page is public.

Create a selections JSON array with actual document IDs, project groups and splits, for example:

```json
[
  {"documentId": 101, "project": "project-one", "split": "train"},
  {"documentId": 205, "project": "project-two", "split": "validation"},
  {"documentId": 309, "project": "project-three", "split": "test"}
]
```

```sh
pnpm jobs export data/knowledge.sqlite selections.json BENCHMARK_HASH
pnpm jobs snapshot SNAPSHOT_HASH
pnpm jobs approve SNAPSHOT_HASH review.json
```

IDs above are illustrative, not supplied data. Obtain actual version IDs from the knowledge database/provenance. Each exported example retains document/source identity, version, original and normalized hashes, URL, license evidence, rights fingerprint, project and transformation version. Normalization only converts line endings and trims edges. Source/project groups cannot span splits. Selected superseded versions remain reproducible after refresh if rights still permit them. Withdrawn, pending or non-training-approved sources are excluded and reported; export fails if exclusions leave any required split empty. Sensitive markers are excluded rather than silently redacted into a different training meaning. The exporter opens the knowledge DB read-only and never fetches network content.

Run `pnpm jobs audit` after source-policy changes. Starts/resumes and the running supervisor revalidate knowledge rights; affected snapshots/checkpoints are flagged for review. Audit does not erase weights. A changed rights fingerprint requires a fresh reviewed snapshot; restoring source access does not silently approve old artifacts. The snapshot records the absolute knowledge DB path, so moving that database requires a newly reviewed export rather than assuming identical IDs refer to the same source. Original project content has no external rights poll; revision/revocation of those permissions requires operator review and stopping its use.

## Budgets and attempts

Default: 10 steps, 60 seconds, 1 GiB RSS, batch size 1 and the existing 44,355-parameter CPU model. `submit HASH config.json` or `resume ID config.json` can specify a reviewed bounded config with `model`, `batchSize`, `steps`, `maxMilliseconds`, `maxRssBytes`. Maximums are 2,000 steps, 7,200,000 ms, 6 GiB, batch size 4 and no model dimension above the existing baseline. No automatic scaling, network or paid compute.

The run timer starts when start claims the job, covering dataset/model preparation, validation, training and checkpoint publication; CLI build and independently reviewed dataset preparation happen before that run. The supervisor polls worker RSS and macOS pressure/swap every 500 ms, requests a stop early and sends SIGKILL by the deadline if needed. Non-normal pressure, >64 MiB swap growth, missing monitoring or insufficient disk stop/refuse work. A sample interval cannot catch every transient; worker peak RSS is also recorded. A 6 GiB ceiling is an upper bound, not a measured safe allocation. Existing OS swap may be large even while pressure is normal; watch other applications and lower budgets if needed. No claim of subjective laptop responsiveness is inferred from a successful run.

Disk preflight reserves 1 GiB plus worst-case checkpoint count × the serializer's 32 MiB limit, temporary/rollback allowance and metadata overhead. Workers check space before publication. Each complete-step checkpoint has its own path; previous attempts' artifacts are untouched. Snapshots, checkpoint history, audit events and failed-attempt records are retained; no automatic deletion or background scheduler exists. Back up the entire training directory only with all jobs stopped and all registry connections closed, or use a proper consistent SQLite backup plus its referenced artifact files. Git pushes do not back up weights.

```sh
pnpm jobs cancel RUN_ID
pnpm jobs resume STOPPED_RUN_ID
pnpm jobs start NEW_RUN_ID
pnpm jobs recover
```

Cancellation of queued jobs is immediate; running jobs receive a graceful request and bounded forced stop. Resource stops and crashes are failed/incomplete, not completed. Resume is a new explicit queued attempt, retaining parent ID and checkpoint hash; it does not restart automatically or overwrite the parent. A killed worker may not save its latest in-flight update. Recovery refuses while either recorded supervisor or worker PID is alive, including conservative PID-reuse ambiguity. Never clear a running record solely because a lease expired; inspect surviving processes first. An orphan may need operator intervention if it is unresponsive. No concurrency guarantee covers separate checkouts, manually created alternate registries or the legacy toy trainer: do not run those concurrently with jobs.

## Select and evaluate once

```sh
pnpm jobs test COMPLETED_TRAINING_RUN_ID
pnpm jobs start TEST_RUN_ID
pnpm jobs status
```

Select using training/validation evidence only. `test` reserves a separate supervised, zero-update evaluation attempt. A UNIQUE reservation prevents repeats for the same snapshot or same frozen benchmark/test-document identity even if training data changed. Cancellation/crash also consumes the reservation; there is no silent retry. A new evaluation strategy and genuinely fresh holdout require review rather than bypassing the reservation. The shipped baseline used a predeclared final checkpoint after 10 updates, not a test-informed search.

`completed` means the bounded operation completed with a validated checkpoint; it does **not** mean the model passed an explanation-quality gate. Test NLL, training loss and human-scored task quality are separate. TASK-019 must establish architecture-answer capability; TASK-020 decides promotion; TASK-017 connects accepted learned inference to RAG. The frozen 30-case architecture benchmark is not scored by TASK-016 and cannot be claimed as passed.
