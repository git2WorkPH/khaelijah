# TASK-015 acceptance — 2026-09-27

Implementation: reviewed page registration, bounded pinned HTTPS fetching, preview/commit, dynamic profiles, withdrawal/reactivation, schema versioning and backup/recovery. See [operator commands and JSON contracts](../Knowledge/SOURCE-OPERATIONS.md).

## Automated verification

`pnpm test`: PASS, 73 tests including build (64 previous + 9 operations tests).
`pnpm typecheck`: PASS. `pnpm lint`: PASS (currently compiler alias, not a separate style/security linter). `git diff --check`: PASS at verification.

`test/source-operations.test.ts` exercises:

- Two original offline HTML fixtures: pending → review → preview → hash commit → read-only reopen → actual ask CLI returning two passages in a custom profile. No example.org content is fetched or granted rights by these tests.
- Rejection/withdrawal removes searchability; direct ingestion cannot bypass withdrawn policy; explicit reactivation still needs fresh content and advances version history.
- Review changes invalidate preview; withdrawal during fetch prevents publication.
- Singleton lease, interval refusal, one retry/backoff for transient status, no 429 retry and preservation of last active content after failure.
- Encoded/private URL, mixed private/public DNS, peer mismatch and exact-path redirect rejection; helper-level DNS/peer fixtures do not replace end-to-end hostile-network testing.
- PDF/login/paywall markers and injected low disk refuse publication; bounded policy preview never grants approval.
- Version-0 migration preserves pre-existing document versions/FTS and refresh audits. Online backup/reopen preserves registry events, audits and version 2; overwrite and future-schema refusal.
- Actual CLI JSON registration/review/health without source-code edits; new-source legacy refresh shortcut refused.

Existing ingestion tests cover streamed size/deadline failure; existing persistent-RAG tests cover provenance, lifecycle validation and hostile source text. No content is executed.

## Live acceptance (isolated temporary DB)

Ran:

```sh
JC_KNOWLEDGE_DB=/tmp/jc-task015-live.1FVUJn/knowledge.sqlite pnpm knowledge:ingest sqlite-appropriate-uses
JC_KNOWLEDGE_DB=/tmp/jc-task015-live.1FVUJn/knowledge.sqlite pnpm knowledge:ask "When should I use SQLite for local application storage?"
```

Verified persisted refresh audit: `added`, 14 chunks, fetch time `2026-09-27T11:04:29.809Z`, document SHA-256 `6bab63bbcf08edea8db064147335ff7609a7100c529d40f45278a0fa75d59960`. Ask exited 0, `grounded`, five cited passages, `source-backed-template`, `modelUsed: false`. No production DB was changed; temporary path is local evidence, not a durable required artifact. Live test covers the previously approved SQLite source only; two-source onboarding acceptance uses original offline fixtures rather than inventing new third-party permissions.

## Limits and follow-on

No training, learned explanation, cloud use or paid service. Policy/rights decisions remain manual. Physical purge, general HTML/browser/PDF extraction and scheduled deployment are excluded. Network/SQL safeguards are not protection against a local actor directly editing the DB. Review the documented retention/backup policy before storing new sources. TASK-016 is approved next; freeze explicit training eligibility, datasets and benchmark before meaningful domain training. Do not mark TASK-016–020 complete based on this report.
