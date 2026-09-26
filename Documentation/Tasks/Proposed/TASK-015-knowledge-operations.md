# TASK-015 — Govern source refresh and persistent lifecycle

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

- [ ] Specify a source registry policy with exact approved paths, license evidence/review time, extraction rules and refresh cadence; review robots/terms per source before registration.
- [ ] Implement transactional persistent withdrawal/reactivation policy, audit reason/time and exclusion from search. Define retention/deletion policy separately rather than silently purging history.
- [ ] Add bounded rate-limited refresh execution, retry/backoff and overlap prevention; scheduled execution requires an explicit operational deployment choice.
- [ ] Add schema version/migration handling, database health checks, supported backup/restore instructions and failure-safe recovery tests. Define redirects/private-address restrictions before broadening host configuration.

## Acceptance and verification

- [ ] Withdrawn sources/chunks cannot reappear through search or unchanged refresh without explicit authorized reactivation.
- [ ] Injected fetch failures/retries/rate limits leave consistent versions and auditable results; no uncontrolled crawling.
- [ ] Migration and backup/restore preserve version history, active FTS results and audit records; verify with temporary DBs.
- [ ] Run pnpm test, pnpm typecheck, pnpm lint and git diff --check; save task-specific acceptance evidence with exact commands/results.

## Out of scope

Unapproved source downloads, vector migration, medical content and automated inference from public accessibility to reuse permission.

## Git and resume

Base: master. Planned branch: task/TASK-015-knowledge-operations. Commit: none. No implementation performed. First action: obtain approval, review dependencies/current code, then refine interfaces and tests before coding.

See [technical handover](../../SessionMemory/TECHNICAL-HANDOVER.md). New risks or expanded scope need their own decision/task, not silent implementation.
