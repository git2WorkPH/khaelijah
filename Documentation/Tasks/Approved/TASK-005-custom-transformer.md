# TASK-005 — Implement the custom TypeScript Transformer inference path

Task Status: APPROVED
Git Status: NOT_STARTED

## Requirement
- REQ-PROD-001

## Architecture decisions
- ADR-001

## Objective
Implement a small custom TypeScript Transformer forward path behind the inference contract, with deterministic tokenization and an explicitly limited plan generator.

## Scope
- Vocabulary tokenizer, model configuration, tensor-free matrix operations, attention, feed-forward layers, and deterministic inference adapter.

## Out of scope
- Internet-scale training, external hosted model calls, fine-tuning, and claims of general-purpose model quality.

## Acceptance criteria
- [ ] The inference implementation is TypeScript-only and uses no hosted model.
- [ ] Identical inputs and weights produce identical output.
- [ ] The adapter returns a response-shaped draft that the RAG validator can inspect.

## Verification expectations
- Build, typecheck, lint, and unit tests must pass.

## Git
- Base branch: task/TASK-004-lexical-retrieval
- Task branch: NOT_CREATED
- Commit: NOT_COMMITTED

