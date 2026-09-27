# TASK-017 — Integrate learned generation behind the RAG boundary

Task Status: PROPOSED
Git Status: NOT_STARTED

## Authorization

New technical follow-on documented for handover. Not implementation approval; request owner approval before moving to Approved/.

## References and dependencies

REQ-PROD-001; REQ-FND-001; ADR-001; ADR-002 where persistent knowledge is involved.
Dependencies: TASK-012, TASK-014, TASK-016, TASK-019 capability evidence and TASK-020 accepted-checkpoint selection/rollback. Do not integrate a merely completed but failed-quality training run as the default answer model.

## Likely files

src/model/trainable/generation.ts (existing); src/core/result.ts; src/rag/grounded-planner.ts; new inference adapter and adversarial tests. New adapters/tests are proposed, not existing code.

## Technical checklist

- [ ] Define a bounded evidence/prompt encoding within model context; document truncation and insufficient-context behavior rather than silently dropping required provenance.
- [ ] Implement InferencePort using a validated checkpoint and explicit model/tokenizer version. Keep legacy template/demo mode identifiable.
- [ ] Resolve only an accepted checkpoint from TASK-020, pin its hash for each request, and expose response mode plus model, dataset and evidence versions. Retain an explicitly labelled passage-only mode when no accepted model is available.
- [ ] Parse/validate full response schema and citation IDs; reject malformed output, unsupported claim/citation pairings and insufficient evidence. Citation membership alone is not semantic support.
- [ ] Add prompt-injection, contradictory/stale evidence, refusal/insufficiency and bounded generation tests; retain post-generation lifecycle checks.
- [ ] Run comparison against passage/template baselines and document a reviewed quality threshold before promoting learned mode.

## Acceptance and verification

- [ ] Invalid schema, hallucinated citations, source-instruction injection and stale evidence never yield an accepted plan.
- [ ] Reported output identifies model/checkpoint and evidence provenance; evaluation is reproducible and read-only.
- [ ] Quality gates pass on held-out realistic tasks or the feature remains explicitly experimental.
- [ ] On the frozen review set, meet the reviewed TASK-019 explanation rubric and at least 95% supported material claims; identify each citation's supporting passage, not just its ID. Report scorer/reviewer disagreements and unsupported claims. These proposed thresholds must be approved before experiments, not changed after failures.
- [ ] For the frozen insufficient-evidence cases, at least 90% yield an appropriate uncertainty/non-answer; all deterministic invalid-schema/citation and stale-evidence tests reject output. Adversarial tests are bounded evidence, not a universal correctness guarantee.
- [ ] Run pnpm test, pnpm typecheck, pnpm lint and git diff --check; save task-specific acceptance evidence with exact commands/results.

## Out of scope

Unrestricted agent tools, hosted-model fallback, claims that schema validation alone ensures factual correctness.

## Goal, inputs and expected results

Input: a question, approved knowledge profile and accepted learned checkpoint. Output: a novel, evidence-grounded explanation with attributable claims, uncertainties and reproducible model/evidence identity—or an explicit inability to answer. This is distinct from TASK-014's fixed quotation template.

## Git and resume

Base: master. Planned branch: task/TASK-017-learned-grounded-inference. Commit: none. No implementation performed. First action: obtain approval, review dependencies/current code, then refine interfaces and tests before coding.

See [technical handover](../../SessionMemory/TECHNICAL-HANDOVER.md). New risks or expanded scope need their own decision/task, not silent implementation.
