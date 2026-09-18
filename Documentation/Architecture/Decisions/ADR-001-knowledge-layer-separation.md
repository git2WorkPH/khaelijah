# ADR-001 — Separate learned model capability from current knowledge

Status: ACCEPTED

## Context

The product needs broad and current knowledge for domains such as technology and medicine, while remaining feasible to build, evaluate, and update. Training a custom model on the entire internet is infeasible, difficult to govern, slow to refresh, and makes provenance unavailable at response time.

## Decision

JC Model will treat the custom TypeScript Transformer and the current-knowledge system as separate components. The model will supply learned language and reasoning capability. The knowledge layer will ingest only approved sources into governed knowledge profiles and expose retrieved passages with provenance to inference and agent workflows.

The system will not claim that its parameters contain the current public internet. Knowledge refreshes will occur through the knowledge layer without requiring a model retrain. Any future model training or fine-tuning uses a separately approved and legally usable corpus.

## Alternatives considered

- Train or continually pre-train on the entire internet.
- Rely only on a fixed training corpus.
- Use an external model with no custom model path.

## Consequences

### Positive

- Current information can be added, revised, revoked, or re-indexed without retraining.
- Responses can carry source provenance and support grounding evaluations.
- Source governance can vary by knowledge profile.
- The first vertical slice is substantially smaller and more measurable.

### Negative / tradeoffs

- Retrieval quality becomes a first-class dependency and failure mode.
- Context limits and ranking may omit relevant evidence.
- The product must operate source ingestion, metadata, indexes, and refresh jobs in addition to the model.
- Retrieved evidence must be protected against prompt injection and source-quality problems.

## Related requirements/tasks

- REQ-PROD-001
- REQ-FND-001
- TASK-001
