# Project Session Context

## Current milestone

TASK-014 is VERIFIED on task/TASK-014-persistent-rag, based on master e64929b. Commit/merge/push pending at this snapshot. TASK-001–014 are verified; TASK-015–018 remain PROPOSED and need approval. TASK-014 was explicitly approved by the owner in conversation.

Read [technical handover](TECHNICAL-HANDOVER.md), [TASK-014](../Tasks/Approved/TASK-014-persistent-rag.md), and [acceptance report](../Acceptance/TASK-014-persistent-rag.md). Do not restart completed work.

## Implementation

- Shared RetrievalPort.retrieve returns passages/warnings; isCurrent validates exact selected identities/content/provenance, independent of ranking. Local demo preserved.
- SqliteRetriever maps database-local stable IDs, profile eligibility, chunk/document hashes, version and license evidence; source registration/publication dates unknown in SQLite are omitted.
- GroundedPlanner clones inference input and revalidates evidence pre/post inference. Content/license refreshes or source/document/chunk withdrawal invalidate evidence; rank changes alone do not.
- Separate src/app/ask.ts opens SQLite read-only: pnpm knowledge:ask. Output mode is source-backed-template, modelUsed false, citationMeaning verbatim source quotation. No network, training or source-instruction execution.
- TASK-012 checkpoint/resume/generation remains separate and verified. Its synthetic patterns are not useful application-building quality. No training-run DB exists.

## Verification

PASS: pnpm test (64 tests including build), pnpm typecheck, pnpm lint (compiler alias), pnpm evaluate and git diff --check.
PASS: pnpm knowledge:ask "When should I use SQLite for local application storage?" against existing local data/knowledge.sqlite returned five cited passages and modelUsed false. No new network fetch.
Eight persistent-RAG tests cover reopen/readonly/CLI/missing DB, provenance, filtering before limit, empty/unmatched queries, content/license refresh, three lifecycle levels through a second connection, rank-only changes, invalid output, clone isolation and hostile source instructions.
No known running processes.

## Git and preservation

Base: master. Current task branch: task/TASK-014-persistent-rag. Implementation commit pending; inspect Git for final closeout/synchronization.
Preserve and EXCLUDE user formatting edits in src/app/train.ts and src/app/knowledge.ts. Neither is changed by TASK-014. Standing authorization: merge verified tasks into master and push origin/master; no unrelated commits, destructive resets or force-pushes.

## Next exact action

Review scoped diff, commit TASK-014 files only, record hash, merge master, push and verify synchronization. Then ask approval for TASK-015 knowledge operations (persistent withdrawal/refresh, migration and backup policy). Do not implement new proposals without approval.

## Reproduce and limits

Use Node >=22.16 and pnpm, TypeScript-only runtime.
- pnpm knowledge:ingest sqlite-appropriate-uses (approved network fetch; not run by ask)
- pnpm knowledge:ask "When should I use SQLite for local storage?"
- JC_KNOWLEDGE_DB selects another existing database; missing DB is not created by ask.
- pnpm model train/resume/generate/experiment remain available; see README.

FTS5 lower-is-better scores are not local lexical thresholds. Keyword matching/citation membership do not establish semantic support. Snapshots are revalidated at observation points, not guaranteed forever after delivery. SQLite schema has no separate source registration/publication date. Back up ignored DB/checkpoint data separately. Training corpus rights are separate from retrieval rights. Medical and workspace-write capabilities need approved safety scope.

Latest usage check during TASK-014 showed 62% five-hour and 78% weekly remaining; no reset consumed. Update task/session memory at meaningful boundaries and at 2% remaining. Historical snapshots do not override current tasks, Git state or evidence.
