# REQ-FND-001 — Governed, refreshable knowledge layer

Status: ACTIVE

## Requirement

The product must maintain current domain knowledge outside model parameters through a governed knowledge layer. Every ingestible item must have source identity, access/licensing context, version or publication date when available, ingestion time, and a status that permits it to be retrieved, superseded, or withdrawn.

## Rationale

The knowledge layer enables current, attributable responses without unbounded corpus collection or repeated model training. Metadata and lifecycle controls are necessary for quality, traceability, and profile-specific governance.

## Scope

- Source registration and approval per knowledge profile.
- Document normalization, chunking, indexing, and retrieval.
- Provenance and lifecycle metadata.
- Refresh, supersession, and withdrawal semantics.
- Retrieval interfaces that return content with metadata.

## Out of scope

- A universal crawler.
- Circumventing source access controls, paywalls, robots policies, or licensing restrictions.
- Medical profile operation before a dedicated safety and governance decision.

## Acceptance criteria

- [ ] A source can be registered with ownership/access and refresh metadata.
- [ ] An indexed passage can be traced to its source and ingestion record.
- [ ] Superseded or withdrawn passages are excluded from default retrieval.
- [ ] Retrieval returns passage identifiers, source information, and timestamps alongside content.
- [ ] A refresh run produces an auditable result including additions, updates, failures, and removals.

## Dependencies

- ADR-001

## Notes

- The first implementation may use a local static corpus while preserving the lifecycle interface required for continuous updates.
