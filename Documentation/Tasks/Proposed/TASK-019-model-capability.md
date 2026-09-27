# TASK-019 — Establish useful narrow-domain model capability

Task Status: PROPOSED
Git Status: NOT_STARTED

## Goal and requirement

REQ-PROD-001; ADR-001. Determine whether our custom TypeScript model can explain one approved technology domain usefully, and what data, context and compute it needs. A running pipeline or synthetic loss reduction is not completion of this capability goal.

## Dependencies and authorization

Depends on TASK-012 and TASK-016's immutable datasets, recorded runs and frozen benchmark. Runs before TASK-020 and TASK-017 despite its higher number. Proposed documentation only: owner must approve domain, compute/time budget and evaluation rubric before implementation or scaling.

## Inputs and expected outputs

Inputs: approved manifests, benchmark/rubric, baseline checkpoint and resource ceiling.
Outputs: reproducible baseline/candidate comparison, context/architecture/data decision, throughput/RSS/time measurements, checkpoint hashes and a go/no-go capability report. A failed experiment is valuable evidence but must not be labelled achieved capability.

## Technical checklist

- [ ] Measure the current 44,355-parameter, 64-byte-context model against the frozen benchmark; include a passage-only/template baseline and initial/untrained control.
- [ ] Measure actual prompt/evidence/answer lengths. Propose a bounded context/tokenizer/architecture change that fits the chosen domain; do not assume a larger model automatically works.
- [ ] Benchmark peak RSS, step time, tokens/second and checkpoint size before scaling. Address existing context/checkpoint limits explicitly; preserve TypeScript-only runtime and numerical correctness tests.
- [ ] Use approved, versioned explanation/instruction examples when needed; do not assume raw document next-token training teaches instruction following. Preserve training rights and source/project split isolation.
- [ ] Specify a limited candidate search plan using development/validation only. Freeze seeds, budget, stopping conditions and scoring before runs. Report all runs, not only the winner.
- [ ] Select on validation; evaluate the sealed final test once for the chosen candidate. Additional tuning requires a fresh held-out set, not repeated test-driven selection.
- [ ] Record failure modes, factual errors, context truncation, uncertainty behavior and limits. If quality fails, propose a reviewed data/compute/architecture change rather than weakening the gate.

## Proposed measurable gates

These thresholds are planning targets, to be reviewed and approved before running the benchmark.

- [ ] At least 20 frozen domain explanation cases and 10 insufficient/conflicting-evidence cases from TASK-016 have reference evidence and a 0–2 rubric for correctness, clarity and question relevance.
- [ ] At least 80% of explanation cases score >=5/6, with no zero for correctness. A human reviewer records per-case judgments and source support; loss is supplementary, not the quality metric.
- [ ] At least 90% of insufficient-evidence cases receive an appropriate uncertainty/non-answer. Report each failure; no claim of universal safety.
- [ ] Compare every candidate to the current learned and passage-only baselines. Record raw metrics and uncertainty for this small benchmark; do not imply broad generalization from the percentages.
- [ ] All numerical, causality, checkpoint/resume and regression tests pass for architectural changes. Runs remain within the approved budget or are marked incomplete.
- [ ] Run pnpm test, pnpm typecheck, pnpm lint and git diff --check; save configuration, commands, hashes, timings and the go/no-go report under Documentation/Acceptance/.

## Scope boundaries and handoff

No hosted-model substitution, medical capability, unrestricted domains, automatic promotion or workspace tools. TASK-020 manages promotion; TASK-017 adds production-path grounding checks. Scaling expenditure requires explicit budget authority.

Likely files: src/model/trainable/, src/training/, datasets/, domain benchmark fixtures and a reviewed architecture ADR.
Base: master. Planned branch: task/TASK-019-model-capability. Commit: none.
First action after approval: freeze domain/rubric/budget and measure the existing baseline.
