# TASK-015 — Website onboarding, refresh and persistent lifecycle

Task Status: VERIFIED
Git Status: MERGED

## Authorization

Owner approved implementation of TASK-015–020. Source-specific rights reviews and task safety/quality gates still apply.

## References and dependencies

REQ-PROD-001; REQ-FND-001; ADR-001; ADR-002 where persistent knowledge is involved.
Dependencies: TASK-013; coordinate the adapter contract with TASK-014.

## Likely files

src/knowledge/{internet-ingest,sqlite-store}.ts; src/app/knowledge.ts; new source-policy/operations tests and ADR updates. Actual runtime entry is src/app/sources.ts; user-owned app/knowledge.ts is unchanged.

## Technical checklist

- [x] Add URL submission and a persisted pending/approved/rejected source registry; separate retrieval/storage permission from training permission. Require recorded reviewer, evidence URL, review time, scope and profile membership. A public page or robots allowance alone is not reuse permission.
- [x] Start with a single user-selected ordinary HTML page, not automatic recursive crawling. Review access/robots policies with bounded fetches before approval; approval precedes content indexing. Keep the existing SQLite source compatible.
- [x] Validate HTTPS, redirects, host/path scope, resolved addresses and actual connection targets; block loopback/private/link-local/metadata endpoints, credentials in URLs, DNS-rebinding and redirect bypasses. Enforce request/body/decompression/time limits, content-type checks and rate limits.
- [x] Define conservative extraction and canonicalization, reject unsupported/paywalled/login-required formats, and preview title/text/license/profile before indexing. Register approved sources in retrieval profiles without a source-code edit.
- [x] Specify a source registry policy with exact approved paths, license evidence/review time, extraction rules and refresh cadence; review robots/terms per source before registration.
- [x] Implement transactional persistent withdrawal/reactivation policy, audit reason/time and exclusion from search. Define retention/deletion policy separately rather than silently purging history.
- [x] Add bounded rate-limited refresh execution, retry/backoff and overlap prevention; scheduled execution requires an explicit operational deployment choice.
- [x] Add schema version/migration handling, database health checks, supported backup/restore instructions and failure-safe recovery tests. Define redirects/private-address restrictions before broadening host configuration.

## Acceptance and verification

- [x] Demonstrate submit URL → pending review → explicit approval → ingest → reopen database → knowledge:ask returns traceable passages, without editing the hard-coded source list. Capture exact proposed CLI commands and outputs during implementation.
- [x] Pending/rejected/out-of-profile sources are not searchable; denied URLs and redirect/DNS/private-network bypass fixtures cannot fetch content or reach blocked destinations.
- [x] Two approved HTML source fixtures with distinct extraction layouts produce useful non-navigation passages and preserve URL, version/hash, license evidence and fetch time. Unsupported formats fail explicitly.
- [x] Withdrawn sources/chunks cannot reappear through search or unchanged refresh without explicit authorized reactivation.
- [x] Injected fetch failures/retries/rate limits leave consistent versions and auditable results; no uncontrolled crawling.
- [x] Migration and backup/restore preserve version history, active FTS results and audit records; verify with temporary DBs.
- [x] Run pnpm test, pnpm typecheck, pnpm lint and git diff --check; save task-specific acceptance evidence with exact commands/results.

## Out of scope

Unapproved content downloads/indexing, recursive crawling, JavaScript-rendered browser extraction, PDF ingestion, authentication/paywall bypass, vector migration, medical content and automatic training. PDF/rendered-page support requires separate tasks.

## Goal, inputs and expected results

Input: an owner-selected technology-domain HTTPS page, requested profile and recorded reuse evidence. Output: an auditable source registration plus searchable versioned passages, or a clear pending/rejection result. “Arbitrary website” means user-selected eligible sources, not unconditional access or reuse.

Unlocks TASK-016 dataset selection; retrieval approval does not grant training approval. Initial live source remains previously reviewed SQLite; new-source onboarding is proven with original offline technology fixtures and requires source-specific human review. Scheduled deployment remains a separate explicit operational choice.

## Git and resume

Base: master (f7760ef). Branch: task/TASK-015-knowledge-operations. Implementation commit: 91f2593. Merge: 299e109, pushed to origin/master. Implementation verified; remaining user-owned edits in app/train.ts and app/knowledge.ts excluded. Next approved implementation: TASK-016.

See [technical handover](../../SessionMemory/TECHNICAL-HANDOVER.md). New risks or expanded scope need their own decision/task, not silent implementation.

## Laptop-only implementation constraints

Follow [TRAINING-BUDGET.md](../../Project/TRAINING-BUDGET.md). Owner hardware/time/local-only requirements are firm; the 6 GiB RSS cap is a proposed starting safeguard, not measured safe capacity. Implementation is approved; resource and quality gates still apply.

- [x] Use the local-only resource policy for fetch/extraction/indexing. Bound concurrent fetches, bytes and temporary extraction artifacts; check free disk before indexing or backup.
- [x] Test insufficient disk and bounded ingestion queues without filling the real disk; refuse work safely and preserve active knowledge/backup data.

## Owner authorization — current

Owner explicitly approved implementation of TASK-015–020 in conversation. This supersedes historical proposed/approval-pending wording above, but not source-specific reuse reviews, capability gates, resource ceilings or workspace-action safety boundaries. Execution order: 015 → 016 → 019 → 020 → 017 → 018. Only TASK-015 is active in this implementation cycle.

## Implementation evidence

See [acceptance report](../../Acceptance/TASK-015-knowledge-operations.md), [operator guide](../../Knowledge/SOURCE-OPERATIONS.md) and [ADR-003](../../Architecture/Decisions/ADR-003-source-operations.md). Runtime files: new source-policy, safe-http, disk-budget and source-operations modules; sqlite-store migration/operations; internet-ingest hardened fetch; new sources CLI; ask profile selection; package commands. Nine new operations tests exercise offline onboarding and lifecycle/recovery; full suite has 73 tests. pnpm test, pnpm typecheck, pnpm lint and git diff --check pass. Live approved SQLite ingestion stored 14 chunks and subsequent ask returned five cited passages with modelUsed false.

Limits: policy review is a human attestation; password/paywall markers are not comprehensive detection. IPv6-only/compressed/redirecting pages may be refused. Original offline fixtures demonstrate new-source onboarding without inventing third-party permissions. Historical data is retained rather than physically purged. Low-level store/test transport APIs assume trusted callers. No automatic scheduler, training, learned answers or workspace changes. Next approved task: TASK-016.
