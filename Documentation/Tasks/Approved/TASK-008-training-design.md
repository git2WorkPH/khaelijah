# TASK-008 — Design the first trainable language model

Task Status: VERIFIED
Git Status: COMMITTED

## Authorization
Owner approved implementation of TASK-008 in conversation. This task delivers the architecture and measurable acceptance criteria; training code and runs are follow-on work.

## Requirement and decision
- REQ-PROD-001 — learned application assistance as the long-term objective.
- ADR-001 — model weights and current knowledge remain separate.

## Scope
Specify a small causal decoder, reversible tokenizer, gradients, optimizer, checkpoint format, data splits, resource limits, and reproducible verification gates. Identify implementation tasks in dependency order.

## Out of scope
Implementing the trainer, running training, fetching data, replacing the RAG adapter, or claiming application-building quality.

## Acceptance criteria
- [x] Architecture specifies dimensions, operations, interfaces, and parameter ownership.
- [x] Data provenance, split isolation, batching, and target masking are specified.
- [x] Numerical, learning, resume, and generation gates have measurable thresholds.
- [x] Resource limits and failure behavior are explicit.
- [x] Proposed follow-on tasks distinguish implementation approval from this design approval.

## Git
- Base: master at 1091899
- Branch: task/TASK-008-training-design
- Commit: c81cca7
- Merge/push: authorized after verification by standing owner instructions.

## Verification
Manual requirements/design review and `git diff --check`; no executable changes or model-quality claims.

## Implementation summary and evidence
- Deliverable: `Documentation/Architecture/TRAINABLE-MODEL.md`.
- Architecture and contracts sections satisfy architecture criteria; data/loss section specifies isolated splits and masks; gates table defines numerical and learning thresholds; loop/checkpoint sections define bounds and failures.
- Follow-on TASK-009 through TASK-012 are proposed only.
- Updated project profile and session memory; runtime unchanged. Build/tests are not applicable to this documentation task.
