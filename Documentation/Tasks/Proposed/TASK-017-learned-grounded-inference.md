# TASK-017 — Integrate learned generation behind the RAG boundary

Task Status: PROPOSED
Git Status: NOT_STARTED

## Authorization

New technical follow-on documented for handover. Not implementation approval; request owner approval before moving to Approved/.

## References and dependencies

REQ-PROD-001; REQ-FND-001; ADR-001; ADR-002 where persistent knowledge is involved.
Dependencies: TASK-012, TASK-014 and demonstrated task-relevant quality from TASK-016.

## Likely files

src/model/trainable/generation.ts (future); src/core/result.ts; src/rag/grounded-planner.ts; new inference adapter and adversarial tests. Paths marked future are proposed, not existing code.

## Technical checklist

- [ ] Define a bounded evidence/prompt encoding within model context; document truncation and insufficient-context behavior rather than silently dropping required provenance.
- [ ] Implement InferencePort using a validated checkpoint and explicit model/tokenizer version. Keep legacy template/demo mode identifiable.
- [ ] Parse/validate full response schema and citation IDs; reject malformed output, unsupported claim/citation pairings and insufficient evidence. Citation membership alone is not semantic support.
- [ ] Add prompt-injection, contradictory/stale evidence, refusal/insufficiency and bounded generation tests; retain post-generation lifecycle checks.
- [ ] Run comparison against passage/template baselines and document a reviewed quality threshold before promoting learned mode.

## Acceptance and verification

- [ ] Invalid schema, hallucinated citations, source-instruction injection and stale evidence never yield an accepted plan.
- [ ] Reported output identifies model/checkpoint and evidence provenance; evaluation is reproducible and read-only.
- [ ] Quality gates pass on held-out realistic tasks or the feature remains explicitly experimental.
- [ ] Run pnpm test, pnpm typecheck, pnpm lint and git diff --check; save task-specific acceptance evidence with exact commands/results.

## Out of scope

Unrestricted agent tools, hosted-model fallback, claims that schema validation alone ensures factual correctness.

## Git and resume

Base: master. Planned branch: task/TASK-017-learned-grounded-inference. Commit: none. No implementation performed. First action: obtain approval, review dependencies/current code, then refine interfaces and tests before coding.

See [technical handover](../../SessionMemory/TECHNICAL-HANDOVER.md). New risks or expanded scope need their own decision/task, not silent implementation.
