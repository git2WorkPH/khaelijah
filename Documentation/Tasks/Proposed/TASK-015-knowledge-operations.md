# TASK-015 — Website onboarding, refresh and persistent lifecycle

Task Status: PROPOSED
Git Status: NOT_STARTED

## Authorization

New technical follow-on documented for handover. Not implementation approval; request owner approval before moving to Approved/.

## References and dependencies

REQ-PROD-001; REQ-FND-001; ADR-001; ADR-002 where persistent knowledge is involved.
Dependencies: TASK-013; coordinate the adapter contract with TASK-014.

## Likely files

src/knowledge/{internet-ingest,sqlite-store}.ts; src/app/knowledge.ts; new source-policy/operations tests and ADR updates. Paths marked future are proposed, not existing code.

## Technical checklist

- [ ] Add URL submission and a persisted pending/approved/rejected source registry; separate retrieval/storage permission from training permission. Require recorded reviewer, evidence URL, review time, scope and profile membership. A public page or robots allowance alone is not reuse permission.
- [ ] Start with a single user-selected ordinary HTML page, not automatic recursive crawling. Review access/robots policies with bounded fetches before approval; approval precedes content indexing. Keep the existing SQLite source compatible.
- [ ] Validate HTTPS, redirects, host/path scope, resolved addresses and actual connection targets; block loopback/private/link-local/metadata endpoints, credentials in URLs, DNS-rebinding and redirect bypasses. Enforce request/body/decompression/time limits, content-type checks and rate limits.
- [ ] Define conservative extraction and canonicalization, reject unsupported/paywalled/login-required formats, and preview title/text/license/profile before indexing. Register approved sources in retrieval profiles without a source-code edit.
- [ ] Specify a source registry policy with exact approved paths, license evidence/review time, extraction rules and refresh cadence; review robots/terms per source before registration.
- [ ] Implement transactional persistent withdrawal/reactivation policy, audit reason/time and exclusion from search. Define retention/deletion policy separately rather than silently purging history.
- [ ] Add bounded rate-limited refresh execution, retry/backoff and overlap prevention; scheduled execution requires an explicit operational deployment choice.
- [ ] Add schema version/migration handling, database health checks, supported backup/restore instructions and failure-safe recovery tests. Define redirects/private-address restrictions before broadening host configuration.

## Acceptance and verification

- [ ] Demonstrate submit URL → pending review → explicit approval → ingest → reopen database → knowledge:ask returns traceable passages, without editing the hard-coded source list. Capture exact proposed CLI commands and outputs during implementation.
- [ ] Pending/rejected/out-of-profile sources are not searchable; denied URLs and redirect/DNS/private-network bypass fixtures cannot fetch content or reach blocked destinations.
- [ ] Two approved HTML source fixtures with distinct extraction layouts produce useful non-navigation passages and preserve URL, version/hash, license evidence and fetch time. Unsupported formats fail explicitly.
- [ ] Withdrawn sources/chunks cannot reappear through search or unchanged refresh without explicit authorized reactivation.
- [ ] Injected fetch failures/retries/rate limits leave consistent versions and auditable results; no uncontrolled crawling.
- [ ] Migration and backup/restore preserve version history, active FTS results and audit records; verify with temporary DBs.
- [ ] Run pnpm test, pnpm typecheck, pnpm lint and git diff --check; save task-specific acceptance evidence with exact commands/results.

## Out of scope

Unapproved content downloads/indexing, recursive crawling, JavaScript-rendered browser extraction, PDF ingestion, authentication/paywall bypass, vector migration, medical content and automatic training. PDF/rendered-page support requires separate tasks.

## Goal, inputs and expected results

Input: an owner-selected technology-domain HTTPS page, requested profile and recorded reuse evidence. Output: an auditable source registration plus searchable versioned passages, or a clear pending/rejection result. “Arbitrary website” means user-selected eligible sources, not unconditional access or reuse.

Unlocks TASK-016 dataset selection; retrieval approval does not grant training approval. Before implementation choose the first narrow domain/source examples and approve the source-review workflow. Scheduled deployment remains a separate explicit operational choice.

## Git and resume

Base: master. Planned branch: task/TASK-015-knowledge-operations. Commit: none. No implementation performed. First action: obtain approval, review dependencies/current code, then refine interfaces and tests before coding.

See [technical handover](../../SessionMemory/TECHNICAL-HANDOVER.md). New risks or expanded scope need their own decision/task, not silent implementation.

## Laptop-only implementation constraints

Follow [TRAINING-BUDGET.md](../../Project/TRAINING-BUDGET.md). Owner hardware/time/local-only requirements are firm; the 6 GiB RSS cap is a proposed starting safeguard, not measured safe capacity. Task implementation still requires approval.

- [ ] Use the local-only resource policy for fetch/extraction/indexing. Bound concurrent fetches, bytes and temporary extraction artifacts; check free disk before indexing or backup.
- [ ] Test insufficient disk and bounded ingestion queues without filling the real disk; refuse work safely and preserve active knowledge/backup data.
