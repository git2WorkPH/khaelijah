# TASK-013 live-ingestion evidence

Date: 2026-09-27 (Australia/Sydney)

Approved source: `https://www.sqlite.org/whentouse.html`
License evidence: `https://www.sqlite.org/copyright.html` — SQLite states that its code and documentation are public domain.

The first live attempt was rejected by the parser because the source omits a closing body tag. The failure was recorded and did not create an active version. After supporting SQLite's legacy `div.fancy` document structure, ingestion into a fresh temporary database succeeded:

```json
{"status":"added","version":1,"chunkCount":14}
```

The query `when should I use SQLite for local storage` returned five active passages. The first result discussed writer concurrency, database size, and device-local storage. Every result included the canonical source URL, publisher, `Public Domain` label, license-evidence URL, fetch timestamp, SHA-256 content hash, version, passage text, and rank.

A subsequent run after the normalizer learned the `&rarr;` entity created version 2, as expected because normalized text changed. Repeating the refresh with identical code returned `unchanged`, version 2, and 14 chunks without creating another active version.

Automated verification uses injected responses and performs no network calls. It covers unchanged refreshes, changed-version supersession, failure preservation, unapproved source rejection, cross-host redirect rejection, content-type and size limits, HTML extraction, chunk limits, persistent provenance, and FTS5 search.
