# TASK-014 acceptance — 2026-09-27

## Outcome

SQLite-backed prompts now use GroundedPlanner through RetrievalPort, with an explicitly labelled, model-free passage/template adapter. Existing local demo behavior is preserved. No learned model integration, network fetching, workspace writes or production withdrawal API was added.

## Commands and results

- `pnpm test` — PASS, 64 tests including build; eight persistent-RAG tests added.
- `pnpm typecheck`, `pnpm lint`, `git diff --check` — PASS. Lint is compiler-based.
- `pnpm evaluate` — PASS, existing five fixture categories retain expected provenance/citation/insufficiency behavior.
- `pnpm knowledge:ask "When should I use SQLite for local application storage?"` — PASS against existing local data/knowledge.sqlite: grounded template, five citations with provenance, modelUsed false. This reused stored documents, not a new network ingestion.

## Technical mapping and policy

- RetrievalPort.retrieve returns passages and warnings; isCurrent checks exact selected evidence independently of ranking. LexicalRetriever.search remains available for existing callers.
- SQLite adapter filters approved source IDs before LIMIT; profile ID is assigned by the adapter. Unknown profiles and empty/unmatched queries are explicit outcomes.
- Chunk IDs are sqlite:chunk:<rowid>; document IDs are sqlite:document:<rowid>, stable within the bound database. Chunk SHA-256 hashes are computed from passage text; documentContentHash is the persisted normalized-document hash. Both are returned, alongside version and ordinal.
- fetchedAt/ingestedAt use the stored document fetch timestamp (TASK-013 does not record a distinct completion timestamp). retrievedAt is request time. Publication/registration dates are unknown and omitted, not invented. SourceRecord.registeredAt is now optional for this reason.
- Raw FTS5 scores are tagged sqlite-fts5 and lower-is-better; the adapter requires minScore=0 to mean match eligibility, not a reused local score threshold. Bounded stop-word-filtered query terms are quoted by the store.
- Prompt connections are read-only: no migrations, ingestion or schema creation. Missing database errors tell users to ingest first. No additional DB schema migration is needed.
- Inference receives a cloned evidence packet; invalid output still goes through schema/citation validation. Source text is copied into labelled quotations, never interpreted as instructions. Membership checks do not prove semantic claim support.
- Freshness is checked before and after inference at those observation points, not guaranteed forever after response delivery.

## Regression evidence

test/persistent-rag.test.ts covers fixture HTML ingestion, close/reopen read-only, complete/stable provenance, CLI labels and no refresh-audit writes; missing DB is not created. It also covers source filtering before limit, score-policy rejection, empty/irrelevant queries, content and license changes during inference, source/document/chunk withdrawal via a separate fixture connection, harmless rank changes (SQLite and local), invalid citations/schema, cloned input isolation, and hostile source instructions remaining quotations. Existing withdrawal and full pipeline tests still pass.

Next proposal: TASK-015 for governed refresh/withdrawal, migration and backup operations. SQL lifecycle mutation in tests is fixture setup only, not a production API. User formatting edits in src/app/train.ts and src/app/knowledge.ts are excluded from TASK-014.
