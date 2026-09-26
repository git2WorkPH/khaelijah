# ADR-002 — Use SQLite for the first persistent knowledge store

Status: ACCEPTED

## Context

The initial RAG demonstration rebuilds an in-memory store from local Markdown. TASK-013 needs durable document versions, provenance, refresh audits, and searchable chunks for a narrow internet-ingestion experiment.

## Decision

Use the SQLite database bundled with the supported Node runtime through `node:sqlite`. Store approved sources, complete normalized document versions, chunks, lifecycle state, content hashes, fetch times, and refresh audits. Use SQLite FTS5 for the first persistent lexical index.

The database is local operational state under `data/` and is not committed. Model weights and optimizer checkpoints remain separate files. Ingested knowledge is not automatically model-training data.

## Consequences

- The first ingestion path requires no database service or native npm dependency.
- Transactions preserve the last active version when parsing or storage fails.
- FTS5 provides transparent lexical search but not semantic similarity.
- `DatabaseSync` is synchronous, so future concurrent service workloads may require a worker or a different adapter.
- The storage interfaces and evidence contracts should permit a future database or hybrid vector index without changing the model.

## Source policy

Every network source must be allowlisted with a canonical HTTPS URL, publisher, declared license/access basis, and license evidence URL. Public accessibility alone is insufficient. TASK-013 begins with SQLite documentation, which the SQLite project declares public domain at `https://www.sqlite.org/copyright.html`.

## Related work

- ADR-001
- REQ-FND-001
- TASK-013
