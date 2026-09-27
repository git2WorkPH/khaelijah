# ADR-003 — Reviewed single-page source operations

Status: Accepted within approved TASK-015 scope.

## Decision

Persist pending/approved/rejected/withdrawn registrations, reviewer evidence and independent retrieval/training permissions in the existing SQLite knowledge DB. Each registration covers exactly one HTTPS URL and one technology profile. Human policy review precedes content fetch; content preview precedes hash-confirmed publication. Seed only the previously reviewed SQLite source for compatibility; do not infer permission for another URL from its domain.

Use schema version 1 with additive transactional registry migration, source event audits, revision-bound 24-hour previews and one expiring content-refresh lease per DB. Keep prior versions/audits; withdrawal excludes content without silently deleting history. Explicit reactivation and fresh ingestion are required after withdrawal. Back up to a new integrity-checked SQLite file; recover by selecting it without overwriting the original.

Pin HTTPS to a validated public IPv4 DNS result, verify original-host TLS and connected peer, and disallow different-URL redirects, compressed responses, credentials and private/reserved destinations. Bound requests, retries, bytes, concurrent content refreshes and disk reserve. There is no recursive crawler, scheduler, browser extraction, authentication or automatic retraining.

## Consequences

New eligible pages can be registered without source-code edits. Rights remain human attestations, not automated legal conclusions. Simple HTML extraction can retain boilerplate and requires preview inspection; unsupported layouts need separate work. IPv6-only/compressed/redirecting sources may be inaccessible under this conservative policy. Resource preflight is not a hard disk quota. The CLI assumes a trusted local operator; direct database edits or injected test transports are not sandboxed. Training eligibility and dataset/checkpoint revocation handling remain TASK-016 onward.

See [operator guide](../../Knowledge/SOURCE-OPERATIONS.md) and [acceptance evidence](../../Acceptance/TASK-015-knowledge-operations.md).
