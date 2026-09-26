# TASK-013 — Public-domain internet ingestion and SQLite search

Task Status: VERIFIED
Git Status: MERGED

Owner authorized TASK-013 before TASK-012 and requires verified work merged and pushed to master.

## References
- REQ-FND-001 — governed, refreshable knowledge layer.
- ADR-001 — current knowledge remains outside model weights.

## Scope
- One allowlisted public-domain source family: SQLite documentation on `sqlite.org`.
- Manual HTTPS fetch with redirect, timeout, content-type, and size limits.
- Conservative HTML-to-text extraction and deterministic chunks.
- Persistent SQLite source, version, chunk, refresh-audit, and FTS5 search records.
- CLI commands to ingest the approved source and search with provenance.

## Acceptance criteria
- [x] No arbitrary URL can be fetched; source license/evidence is registered before ingestion.
- [x] Successful refresh is transactional and records source URL, license, timestamps, hash, version, chunks, and audit.
- [x] Unchanged refresh does not duplicate active data; changed content supersedes prior chunks.
- [x] Failed fetch/parse leaves the prior active version searchable and records failure.
- [x] Search returns active passages with URLs, license, hash/version, rank, and timestamps.
- [x] Tests use injected fetches; a manual live-source acceptance run succeeds.

## Out of scope
Broad crawling, JavaScript-rendered sites, scheduled refresh, vector embeddings, training on ingested text, or medical sources.

## Git
- Base: master
- Branch: task/TASK-013-internet-knowledge
- Implementation commit: bba121f
- Merge commit: 88e6714

## Verification
PASS: `pnpm test` (51 tests including build), `pnpm typecheck`, `pnpm lint`. Live ingestion added version 1 with 14 chunks; live FTS5 search returned provenance-complete results. Stream size/timeout and long-token chunk preservation regression checks also pass. See `Documentation/Acceptance/TASK-013-live-ingestion.md`.

Implementation: `src/knowledge/{internet-ingest,sqlite-store}.ts`, `src/app/knowledge.ts`, CLI scripts, tests, ADR-002, README, and acceptance evidence. Node's built-in SQLite API is used; no npm runtime dependency was added. The unrelated pre-existing formatting edit in `src/app/train.ts` is excluded from this task.
