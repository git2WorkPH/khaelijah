# Project Session Context

## Current state

Documentation handover prepared on 2026-09-27. No product code changed in this handover.
TASK-001–011 and TASK-013 are VERIFIED and included in master/origin/master at baseline 35ee33e. TASK-012 is APPROVED but not implemented; its missing task record has now been restored. TASK-014–018 are new PROPOSED follow-ons requiring approval.

Read [TECHNICAL-HANDOVER.md](TECHNICAL-HANDOVER.md) for runtime paths, commands, database/checkpoint recovery, pitfalls, and detailed continuation instructions. Read [task index](../Tasks/README.md) for every task's status and dependencies.

## Repository / closeout

- Base/current branch: master. Handover branch: docs/technical-handover; documentation commit 62e14a9, merge f535132. Inspect git log for the following memory closeout commit.
- Last runtime implementation: bba121f (TASK-013); merge 88e6714; prior closeout 35ee33e.
- Handover merge f535132 was successfully pushed to origin/master and synchronization verified. This memory-only closeout follows it; verify actual Git state on resume rather than repeating the completed handover merge.
- Preserve uncommitted user formatting change in src/app/train.ts. It is excluded from the documentation commit.
- No known running training/ingestion process at handover.

## Verification and capability boundaries

Rechecked during this handover: pnpm test (51 tests including build), pnpm typecheck, pnpm lint, git diff --check passed; all 46 local Markdown links in Tasks/SessionMemory/Project resolved. Lint is compiler-based. Task-specific historical counts remain in each record.
Toy AdamW training is implemented and verified, but weights are not persisted yet. Synthetic learning is not application-building quality.
SQLite internet ingestion and FTS5 passage search are implemented; only sqlite-appropriate-uses is registered. They are not connected to the existing template-based RAG planner or automatically used for training.
The knowledge DB is ignored local data, not backed up by Git. No training-run DB exists.

## Next exact action

Check git status/log and remote synchronization, then start TASK-012 using its approved checklist and project-development skill: checkpoint schema/validation and round-trip tests, optimizer/cursor resume, bounded generation, then three-seed held-out evaluation. Read TRAINABLE-MODEL.md and current implementation first. The technical handover is complete; do not reimplement delivered tasks.

Relevant files: src/training/{trainer,optimizer,dataset}.ts, src/model/trainable/{decoder,parameters,tokenizer}.ts, TASK-012 record. Checkpoint and generation modules do not exist yet. Preserve the train.ts user diff when work overlaps.

## Standing constraints

Use pnpm and TypeScript-only runtime. No hosted model dependency. Merge each completed verified task into master and push origin/master; no force-push or unrelated commits. Knowledge and weights stay separate (ADR-001); SQLite decision is ADR-002. Public availability does not imply reuse rights. Medical and write-capable agent scope need separate approval/safety work. Update memory at meaningful boundaries and immediately at 2% remaining credit; no unattended credit monitor is installed.

Historical TASK-011-HANDOFF.md is superseded by this file. Memory summarizes authoritative tasks/designs and does not override them.
