# TASK-014 — Connect persistent knowledge to grounded prompts

Task Status: VERIFIED
Git Status: MERGED

## Authorization

Owner explicitly approved TASK-014 in conversation. Implement on task/TASK-014-persistent-rag; merge and push verified master under standing authorization.

## References and dependencies

REQ-PROD-001; REQ-FND-001; ADR-001; ADR-002 where persistent knowledge is involved.
Dependencies: TASK-013; TASK-006. TASK-012 is not required for passage/template mode.

## Likely files

src/core/contracts.ts; src/knowledge/retrieval.ts; src/knowledge/sqlite-store.ts; src/rag/grounded-planner.ts; src/app/knowledge.ts. Paths marked future are proposed, not existing code.

## Technical checklist

- [x] Define one retrieval abstraction and lifecycle revalidation contract; current GroundedPlanner calls concrete LexicalRetriever.search while RetrievalPort exposes async retrieve.
- [x] Map SQLite results to evidence passages with stable chunk/document/source IDs, profile assignment, hash/version, license and retrieval/fetch timestamps. Do not invent published dates or reuse incompatible lexical-score thresholds.
- [x] Add a persistent-store adapter and source-backed prompt CLI; label passage-only/template responses accurately. Preserve existing local demo compatibility.
- [x] Revalidate exact evidence identity/lifecycle after inference rather than treating ranking changes alone as document invalidation. Treat source text as untrusted data.

## Acceptance and verification

- [x] Integration test: ingest fixture into a temporary DB, reopen it, ask a prompt and obtain provenance-complete evidence.
- [x] Empty/irrelevant query, superseded evidence and invalid citation produce explicit non-plan states; test refresh during inference.
- [x] No model training or general natural-language answer claim; all existing tests pass.
- [x] Run pnpm test, pnpm typecheck, pnpm lint and git diff --check; save task-specific acceptance evidence with exact commands/results.

## Out of scope

Learned model replacement, autonomous writes, broad crawling and embeddings.

## Git and resume

Base: master at e64929b. Branch: task/TASK-014-persistent-rag. Implementation commit: 23aa823. Merge commit: ef34809. Verified master push is authorized.

See [technical handover](../../SessionMemory/TECHNICAL-HANDOVER.md). New risks or expanded scope need their own decision/task, not silent implementation.

## Implementation and handover

- Shared RetrievalPort returns RetrievalOutcome and checks exact evidence via isCurrent. GroundedPlanner no longer depends on concrete LexicalRetriever or ranking-based freshness checks; cloned evidence isolates inference mutations.
- SqliteRetriever maps database-local stable IDs, profile eligibility, chunk/document hashes, version, source license evidence and timestamps. Unknown publication/registration timestamps are omitted. SQL allowlist filtering precedes limit; FTS5 scores remain explicitly distinct from local lexical thresholds.
- PassagePlanAdapter produces quotations plus a fixed review recommendation, never a learned answer or source-instruction execution. The separate src/app/ask.ts CLI uses read-only SQLite and labels mode/modelUsed/citationMeaning.
- Changes: src/core/contracts.ts, src/knowledge/{retrieval,sqlite-store,sqlite-retrieval}.ts, src/rag/{grounded-planner,passage-plan}.ts, src/app/ask.ts, package.json, test/persistent-rag.test.ts, documentation. Preserve/exclude unrelated src/app/train.ts and src/app/knowledge.ts formatting edits.
- PASS: pnpm test (64 tests including build), pnpm typecheck, pnpm lint, pnpm evaluate, git diff --check, and local persisted-knowledge CLI smoke.
- [Acceptance evidence](../../Acceptance/TASK-014-persistent-rag.md) records exact commands, metadata semantics, lifecycle/ranking/concurrency tests and limits.
- Remaining original scope: none. TASK-015 knowledge operations remains proposed; no production withdrawal/scheduler or learned decoder integration was added.
