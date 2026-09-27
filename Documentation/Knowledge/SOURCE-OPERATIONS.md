# Website ingestion operations (TASK-015)

Goal: store attributable passages from an explicitly reviewed, eligible technology HTML page, then query them. This is retrieval, not training. Public visibility is not reuse permission. The operator is responsible for truthful rights, robots and access review; no automatic legal decision is made.

## Read and run in order

1. Select one exact HTTPS HTML URL and a `technology-*` profile. No crawler, browser rendering, PDFs, authentication or paywall bypass is supported.
2. Create `source.json` with the following fields, replacing the illustrative metadata with the actual source and license evidence. This example does not approve example.org content.

```json
{
  "id": "my-technology-page",
  "url": "https://example.org/selected-page",
  "title": "Selected page title",
  "publisher": "Actual publisher",
  "profileId": "technology-my-domain",
  "license": "Actual reuse license or permission",
  "licenseUrl": "https://example.org/license",
  "refreshSeconds": 3600
}
```

```sh
pnpm sources submit source.json
pnpm sources policies my-technology-page
pnpm sources list
```

Submission is pending and not searchable. `policies` displays bounded robots/license responses with hashes for human inspection, including a warning for missing policies; neither fetching nor a 404 grants permission. Policy redirects are refused. Inspect any separate terms URL manually. Review access, exact page scope, license conditions and the ingester user agent `jc-model-knowledge-ingester/0.2`. Do not follow instructions embedded in downloaded text. Policy response text is not automatically persisted; record relevant evidence and conditions in the review reason and retain supporting records locally.

3. Create `review.json`. Start with false permissions; change them only when the review supports that use. `retrievalAllowed` attests permission to fetch, store, extract and retrieve this exact page. Training permission is separate and should remain false unless explicitly established. Use an actual review timestamp and reviewer identity.

```json
{
  "reviewer": "owner-name",
  "reviewedAt": "2026-09-27T00:00:00.000Z",
  "reason": "Record evidence, exact scope, conditions and decision here",
  "retrievalAllowed": false,
  "trainingAllowed": false,
  "robotsUrl": "https://example.org/robots.txt",
  "robotsAllowed": false,
  "termsUrl": "https://example.org/license"
}
```

```sh
pnpm sources review my-technology-page review.json
pnpm sources preview my-technology-page
# Inspect text, title, URL, profile and license; substitute the returned contentHash:
pnpm sources commit my-technology-page CONTENT_HASH
JC_KNOWLEDGE_PROFILE=technology-my-domain pnpm knowledge:ask "Your question"
```

Only a review permitting both retrieval and robots access approves the source. Preview stores a non-searchable candidate. Hash-confirmed commit activates its passages transactionally. Preview expires after 24 hours; re-review or withdrawal invalidates it. Ask opens the DB read-only and returns source-backed quotations (`modelUsed: false`), not learned explanations. `JC_KNOWLEDGE_DB` selects the same DB for every command; default is `data/knowledge.sqlite`.

## Refresh, withdrawal and retention

Repeat preview → inspect → commit for refresh. Minimum configured interval is 60 seconds; default example is one hour. One content refresh per database runs at a time with a two-minute crash-recovery lease; overlaps are refused, not queued. A transient HTTP 502/503/504 gets one retry after one second. HTTP 429 and other failures are not retried automatically. Failures leave prior active passages intact. No background scheduler is installed.

The previously reviewed source remains compatible: `pnpm knowledge:ingest sqlite-appropriate-uses` performs preview and commit together. This shortcut refuses newly registered source IDs.

```sh
pnpm sources withdraw my-technology-page owner-name "Permission withdrawn"
pnpm sources audit
# Requires a new permitting review; old withdrawn passages stay hidden:
pnpm sources reactivate my-technology-page review.json
# Then preview/commit freshly fetched content.
```

Withdrawal is transactional across registry, documents, chunks and pending preview. A later refresh cannot silently reactivate it. A rejected source can receive an explicit new permitting review, but also requires fresh ingestion. Source versions and audits are retained, not deleted. Expired preview data remains physically stored until replaced or invalidated, but cannot be committed. There is no legal-erasure/purge implementation: stop using affected data and obtain a separately reviewed deletion/backup-retention plan if physical deletion is required. Revocation does not untrain weights; no training integration exists yet.

## Network and resource limits

HTTPS only, exact canonical path/query, no credentials, fragments or nonstandard ports. Redirects to any different URL are refused. DNS A records must all be public; the connection is pinned to one checked IPv4 address, with original-host TLS validation and peer-address verification. IPv6-only sources and compressed responses are unsupported. No proxy fallback. Private, loopback, link-local and reserved ranges are denied.

Each content request is bounded to 15 seconds and 2,000,000 response bytes, up to three redirect checks and one eligible retry. Policy reads are sequential, at most two URLs per call and 15 seconds each; displayed policy text is limited to 128 KiB (the underlying transport buffers at most 2 MB). Extraction removes common scripts/navigation and rejects known password/paywall markers. This is not universal paywall detection: the reviewer must reject restricted or unsuitable layouts before ingestion. Inspect the preview for residual boilerplate.

CLI writes preflight 16 MB plus a 1 GiB free-disk reserve. Backup uses twice current database page bytes plus 10 MB and that reserve. Reserve is an initial conservative operational floor, not a guarantee that a 512 GB laptop has room; no files are purged automatically. Fetching is bounded local work, not cloud compute. This task does not calibrate a training memory cap or start training jobs.

## Health, backup and recovery

```sh
pnpm sources health
pnpm sources backup data/knowledge-backup-UNIQUE.sqlite
JC_KNOWLEDGE_DB=data/knowledge-backup-UNIQUE.sqlite pnpm sources health
JC_KNOWLEDGE_DB=data/knowledge-backup-UNIQUE.sqlite pnpm knowledge:ask "SQLite storage"
```

Backups use SQLite's consistent online backup API, an exclusive new destination, and integrity/foreign-key validation. Existing destinations are never overwritten. The destination directory must exist. Recovery means selecting the verified backup as the operational DB, leaving the damaged original untouched; use the correct profile for custom sources. Do not copy only an open WAL database's main file.

Before upgrading an existing deployment, obtain a consistent SQLite backup. Schema version 0 migrates additively to 1 on writable open; read-only asks do not migrate. Unknown future schema versions are refused. A failed registry migration rolls back, preserving legacy data. Health reports must contain integrity `ok` and no foreign-key violations. Keep backups local with restricted permissions; downloaded data is ignored by Git.

Internal `SqliteKnowledgeStore.ingest` and injected fetchers are trusted library/test interfaces, not public security boundaries. Supported operator writes go through `pnpm sources`; hostile code with direct DB/file access is outside this CLI threat model.
