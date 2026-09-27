# Project Session Context — 2026-09-27

## Current milestone

TASK-001–015 verified. Owner explicitly approved TASK-015–020. This development cycle implements TASK-015 only, as required by the project-development skill. Remaining approved order: 016 → 019 → 020 → 017 → 018. Do not request blanket implementation approval again or label remaining tasks complete.

Read [technical handover](TECHNICAL-HANDOVER.md) in its documented order, [TASK-015 acceptance](../Acceptance/TASK-015-knowledge-operations.md), [operator guide](../Knowledge/SOURCE-OPERATIONS.md), then [TASK-016](../Tasks/Approved/TASK-016-domain-dataset-evaluation.md).

## Implementation and verification

TASK-015 adds persisted reviewed registrations, separate retrieval/training permissions, bounded policy display, public-IPv4-pinned HTTPS, exact-URL scope, explicit text-preview/hash commit, dynamic technology profiles, refresh lease/rate/retry, transactional withdrawal/reactivation, additive schema 1, health and consistent non-overwriting backup/reopen recovery.

PASS: pnpm test (73 including build), pnpm typecheck, pnpm lint (compiler alias) and git diff --check. Live approved SQLite fetch in isolated /tmp/jc-task015-live.1FVUJn/knowledge.sqlite: added 14 chunks; ask returned grounded with five citations and modelUsed false. This temp DB is not a durable requirement; operator guide has reproducible commands. No production knowledge DB changed and no training job ran.

Current answers are still source-backed templates. TASK-012 toy checkpoint/resume/generation remains separate. No domain training-run registry or useful learned-explanation capability yet. Human review remains responsible for rights and restricted-page eligibility. No scheduled crawling, automatic model training, purge or workspace-write capability was added.

## Git and preservation

Base master at start: f7760ef. Task branch: task/TASK-015-knowledge-operations. Implementation verified; commit/merge/push closeout is the current action. Check Git and this file's next revision for final hashes; do not infer a push from verification alone.

Preserve and EXCLUDE user formatting edits in src/app/train.ts and src/app/knowledge.ts. These are not TASK-015 changes. Only the new sources CLI and package script alter the supported ingestion command. Standing authorization: merge verified tasks into master and push origin/master. No unrelated commits, destructive resets or force pushes.

## Next exact action

Finish scoped TASK-015 Git closeout if still pending; then implement approved TASK-016 on its own branch using project-development. Read its full requirements and existing dataset/trainer/checkpoint code. Design the training registry ADR, immutable source-version exports with explicit training rights, job lifecycle and resource supervision. Do not treat retrieval-approved SQLite data as automatically training-approved. Freeze a narrow domain, eligible examples and human-reviewed evaluation rubric before capability experiments. Later work must preserve test isolation and cannot mark useful explanations achieved merely because a pipeline runs.

## Constraints and resources

Use pnpm and TypeScript-only product code; Node >=22.16. Owner M3 MacBook Pro with 18 GB RAM/512 GB total storage. Local-only, no paid cloud or remote compute, at most 7,200 seconds/run, preserve other-app headroom. Proposed initial RSS ceiling 6 GiB is not calibrated safe capacity; shorter/lower defaults remain valid. TASK-015 bounds fetch concurrency/bytes/time and checks a 1 GiB disk reserve plus estimated operation bytes. Training supervision and pressure calibration remain TASK-016 onward; free capacity is not total capacity.

Last usage check: 37% five-hour and 58% weekly remaining; no reset consumed. Save memory at meaningful boundaries and immediately at 2% remaining, as requested. No unattended credit monitor installed. No known running training/server processes; closeout may have verification commands in flight, inspect tool/Git state before restarting.
