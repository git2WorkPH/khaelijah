# TASK-014 — Connect persistent knowledge to grounded prompts

Task Status: PROPOSED
Git Status: NOT_STARTED

## Authorization

New technical follow-on documented for handover. Not implementation approval; request owner approval before moving to Approved/.

## References and dependencies

REQ-PROD-001; REQ-FND-001; ADR-001; ADR-002 where persistent knowledge is involved.
Dependencies: TASK-013; TASK-006. TASK-012 is not required for passage/template mode.

## Likely files

src/core/contracts.ts; src/knowledge/retrieval.ts; src/knowledge/sqlite-store.ts; src/rag/grounded-planner.ts; src/app/knowledge.ts. Paths marked future are proposed, not existing code.

## Technical checklist

- [ ] Define one retrieval abstraction and lifecycle revalidation contract; current GroundedPlanner calls concrete LexicalRetriever.search while RetrievalPort exposes async retrieve.
- [ ] Map SQLite results to evidence passages with stable chunk/document/source IDs, profile assignment, hash/version, license and retrieval/fetch timestamps. Do not invent published dates or reuse incompatible lexical-score thresholds.
- [ ] Add a persistent-store adapter and source-backed prompt CLI; label passage-only/template responses accurately. Preserve existing local demo compatibility.
- [ ] Revalidate exact evidence identity/lifecycle after inference rather than treating ranking changes alone as document invalidation. Treat source text as untrusted data.

## Acceptance and verification

- [ ] Integration test: ingest fixture into a temporary DB, reopen it, ask a prompt and obtain provenance-complete evidence.
- [ ] Empty/irrelevant query, superseded evidence and invalid citation produce explicit non-plan states; test refresh during inference.
- [ ] No model training or general natural-language answer claim; all existing tests pass.
- [ ] Run pnpm test, pnpm typecheck, pnpm lint and git diff --check; save task-specific acceptance evidence with exact commands/results.

## Out of scope

Learned model replacement, autonomous writes, broad crawling and embeddings.

## Git and resume

Base: master. Planned branch: task/TASK-014-persistent-rag. Commit: none. No implementation performed. First action: obtain approval, review dependencies/current code, then refine interfaces and tests before coding.

See [technical handover](../../SessionMemory/TECHNICAL-HANDOVER.md). New risks or expanded scope need their own decision/task, not silent implementation.
