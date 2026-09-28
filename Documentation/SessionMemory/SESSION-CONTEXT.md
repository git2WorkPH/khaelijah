# Project Session Context — 2026-09-28

## Current milestone

TASK-001–016 verified; TASK-016 implementation d179f28 and merge 653e4d6 are pushed to origin/master. Owner explicitly approved TASK-015–020. Remaining order: **019 → 020 → 017 → 018**. Use project-development for exactly one approved task per cycle, and project-session-memory at meaningful boundaries/2% remaining.

Owner chose **application architecture**, not SQLite-backed storage, and explicitly approved freezing original project-authored examples, the 20 explanation + 10 uncertainty/conflict benchmark, and a short 60-second/1 GiB supervised baseline. Do not repeat domain-selection or blanket implementation-approval questions.

Read [technical handover](TECHNICAL-HANDOVER.md), [TASK-016](../Tasks/Approved/TASK-016-domain-dataset-evaluation.md), [operator guide](../Training/JOBS.md), [acceptance](../Acceptance/TASK-016-domain-dataset-evaluation.md), then [TASK-019](../Tasks/Approved/TASK-019-model-capability.md).

## Implemented and verified

New jobs CLI plus snapshot, registry, job-policy, resource-monitor, supervisor and worker modules. Separate SQLite metadata store at data/training/registry.sqlite; weights in per-attempt checkpoint files. Explicit source-version export or original-corpus preview → reviewed immutable snapshot → queue → start. Cancellation, explicit resume lineage, conservative recovery, one worker per registry and one-time held-out evaluation. Source rights revalidated on export/start/resume/runtime; audit flags affected runs. No retraining on ingestion and no automatic promotion.

PASS: pnpm test (84 including build), pnpm typecheck, pnpm lint (compiler alias), git diff --check. Preserve historical TASK-015 acceptance separately. The new tests use small real child processes and injected observations; no network/full-disk/two-hour stress tests.

Actual owner-approved baseline:
- Benchmark hash: 197bef45aabec89de045aba42def0fa2ea19e28d1d293ffa8cef23d172e47127.
- Snapshot hash: 5d2be92603e799d8a42e8f6ba46bcfa3a728154c2c7d92bb2f582c5f461e7fa1.
- Training run: 964616ad-8fb1-4473-b5b4-2014e4d9f3d1; ten steps, seed 11, 44,355 parameters, 819 ms, peak worker RSS 265060352 bytes.
- Validation NLL: 5.8573883255909935 → 4.625060627977373.
- Selected final checkpoint payload hash: abe86c7fa1fa648b8c306784b6c7c271fd10619ebb28dfa13b8ed17fca0648d0.
- Zero-update final loss-test run: c3a7dd63-d661-4341-8f32-800935e69291; NLL 4.6412598024329945, 314 ms.
- Raw run/resource/checkpoint evidence is committed as Documentation/Acceptance/TASK-016-baseline.json; actual weight files/DB remain local ignored data and require separate backup.

The loss-test split has been inspected once and cannot silently be reused for candidate tuning. The 30-case architecture-answer rubric remains unscored. No useful learned explanation, human capability score or promotion is claimed. Tiny corpus/context and single seed are explicit limitations.

## Git and preservation

Base at start: master b88e512. Task branch: task/TASK-016-domain-dataset-evaluation. Implementation d179f28 merged as 653e4d6 and pushed; current branch is master. This documentation-only closeout records the delivered state; use git log for its subsequent hash. The prior low-credit documentation edits were ours and are included in TASK-016.

Preserve and EXCLUDE user formatting edits in src/app/train.ts and src/app/knowledge.ts. No TASK-016 change touches them. Standing authorization: merge verified task branch into master and push origin/master; no unrelated commits, force pushes, destructive resets or automatic branch deletion.

## Next exact action

Begin approved TASK-019. Read the frozen benchmark/rubric, source-to-example lineage, baseline limits and job resource policy. Establish honest human-scored architecture capability evidence before data/model/context improvements. If reusing any inspected loss holdout, record an explicit new evaluation strategy/fresh holdout; do not tune against the prior test. TASK-020 owns checkpoint promotion, TASK-017 learned RAG and TASK-018 workspace actions.

## Resource and safety constraints

MacBook Pro M3, 18 GB RAM/512 GB total storage; local-only, no paid cloud/remote compute. Absolute cap 7,200 seconds and 6 GiB RSS; default jobs 60 seconds/1 GiB. Actual larger-run safe capacity is not calibrated. Jobs reserve 1 GiB disk plus checkpoint/temporary/history estimates. Monitor is macOS-only and fails closed without ps/sysctl permission. Pressure/swap/RSS sampling is not an OS hard reservation; no subjective responsiveness result exists.

System swap was already substantial (~15 GB) while observed pressure was normal; do not attribute that to this subsecond baseline. Jobs stop on non-normal pressure or >64 MiB growth. Do not run legacy toy trainers or other checkouts concurrently: concurrency is enforced only in the supported fixed per-checkout registry. Recovery refuses live/reused recorded PIDs. Forced termination may leave a last validated earlier checkpoint, not the final update. Keep all snapshot/checkpoint history unless a separate deletion policy is approved.

At the closeout continuation the usage window had reset: 100% five-hour and 37% weekly remaining; no reset credit consumed. The earlier approval-service refusal was due to exhausted usage, not a code failure. Save memory immediately at 2% remaining. No unattended credit monitor. Baseline/evaluation and runtime verification finished in the prior implementation cycle; this continuation only checks and commits documentation, with git diff --check passing. No known running worker. Inspect Git for this closeout commit and push before starting TASK-019.
