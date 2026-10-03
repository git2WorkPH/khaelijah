# Future roadmap — an owned model and research coworker

Status: captured product direction; **future work, not currently approved implementation**. Revisit after TASK-019 → 020 → 017 → 018. This roadmap does not change current acceptance gates or authorize source ingestion, training runs, dependencies, cloud compute, repository writes or model promotion.

## End goal

JC Model is an application for building, evaluating and improving our own model, and using it as a coworker. The coworker should research topics, explain findings, generate and test code, and produce useful work across selected domains, including technology and medical research. Coding is the first concrete capability track; the long-term product is broader than a coding assistant.

The owner clarified this direction on 2026-10-03. Improvement means explicit, versioned training and evaluation with promotion and rollback. Adding web knowledge makes it available for retrieval; it changes model weights only when separately approved material enters a training job. User feedback and successful work can become reviewed candidate training data.

Build an owned coding system that can learn durable programming skills from legally reusable public code and technical material, retrieve current knowledge from governed websites and repositories, and operate on a codebase through a reviewable inspect → edit → build → test → repair loop. The target experience is comparable in workflow to coding assistants such as Copilot or Codex; parity in model intelligence, breadth or performance is not implied by completing the current roadmap.

The model and current-knowledge layer remain separate. Training supplies durable language, coding and tool-use capability. RAG supplies current APIs, documentation, repository context and provenance. The agent supplies bounded workspace actions and verification. Evaluation and promotion decide whether any checkpoint may enter those paths.

## Shared coworker capabilities

| Track | Deliverable | Expected evidence |
| --- | --- | --- |
| Model development | Create datasets, train/resume candidates, compare capabilities, select a model and roll back | Reproducible runs, held-out evaluations, regression results and traceable model versions |
| Research | Turn a question into a research plan, retrieve sources, compare findings and produce a cited synthesis | Relevant coverage, supported claims, publication dates, conflicting evidence and explicit uncertainty on unseen questions |
| Work execution | Maintain task state, use scoped tools, produce documents or code, verify results and request human input where needed | Reproducible task completion, recoverable interruptions, permission checks and artifact review |
| Domain expansion | Add a reviewed knowledge profile, training corpus and evaluation set for each new specialty | Domain-specific quality gates and qualified review before claiming expertise |
| Continual improvement | Collect feedback and reviewed work, propose dataset revisions and train candidate versions | Measurable improvement without regressions; lineage, approval, promotion and rollback records |

The TypeScript product and custom Transformer remain the project direction. Hardware and accelerated-backend choices need measured feasibility work. Discussion of a future workstation does not replace the existing laptop execution budget.

## Medical research track

Start with literature discovery, evidence summaries, comparison of study findings and research notes. Preserve source identity, publication/version dates, corrections or retractions when known, and the passages supporting each material claim. Distinguish study findings from interpretation, and report limitations and disagreements.

Before implementation, define a narrow research use case and approved sources, then create separate training and evaluation material. Evaluate citation accuracy, evidence quality, factual correctness, uncertainty and handling of conflicting or outdated findings. A reviewer qualified in the selected medical topic must assess outputs before the product claims reliable medical research support.

Initial scope excludes patient-specific diagnosis, prescribing and autonomous clinical decisions. Any later clinical use needs its own requirements, privacy controls, validation and professional oversight. Patient records are not part of the initial corpus. Public availability alone does not establish permission to reuse medical publications for training.

Expected first result: a user asks a scoped medical research question and receives a source-linked synthesis that explains the findings, limitations and open questions, with enough provenance for a human to verify it.

## Coding milestones

| Milestone | Deliverable | Evidence required before completion |
| --- | --- | --- |
| F1 — licensed repository ingestion | Register repositories/commits, inspect licence, select allowed paths, reject secrets/vendor/generated/binary content, preserve file/commit/licence provenance and withdrawal state | Offline fixtures plus approved real repositories; licence allow/deny, secret, symlink/path, history and revocation tests |
| F2 — code-aware corpus | Versioned examples for completion, explanation, edit, test and repair; repository-level train/validation/final isolation; deduplication across forks and generated variants | Corpus audit, exact hashes, transformation versions, contamination report and human source review |
| F3 — code representation and context | Code-capable tokenizer, file/symbol boundaries and context sufficient for scoped multi-file TypeScript tasks | Roundtrip tests, context/truncation metrics, checkpoint migration, numerical parity and laptop resource profile |
| F4 — coding model | A larger custom TypeScript model trained on approved code/instructions within an explicitly revised compute plan | Loss plus unseen syntax/type/behavior evaluations; all attempts reported; no final-set tuning |
| F5 — code evaluation | Hidden, disposable repositories with parse/typecheck/build/test/security and diff-quality gates | Unseen-project pass rates, baseline comparisons, failure taxonomy, resource measurements and independent review |
| F6 — repository agent | Scoped search/read/patch/test/repair loop with approvals, bounded retries, rollback and audit | Escape/permission/destructive-action tests and successful bounded features on multiple unseen repositories |
| F7 — current technical RAG | Retrieve repository symbols, tests and approved current documentation with material-claim provenance | Relevance, freshness, citation support, stale/withdrawn evidence and prompt-injection evaluations |
| F8 — continual improvement | Reviewed successful traces become candidate data; explicit retrain/evaluate/promote/rollback lifecycle | No automatic learning from unreviewed interactions; regression suite and rollback reproduction |

## Source governance

Public visibility is not public domain or training permission. Each repository and website needs an explicit licence/reuse decision. Retain repository URL, commit, path, licence evidence and transformation lineage. Exclude unknown/incompatible licences by default, secrets, personal data, credentials, vendored dependencies, generated artifacts and benchmark contamination. Treat forks and copied snippets as duplicate lineages. Withdrawal blocks future retrieval/export/training under policy and triggers review of derived checkpoints; it cannot erase learned weights.

## Capability ladder

Start with unseen, single-function TypeScript generation from a signature and tests. Progress to one-file edits, then bounded multi-file changes, then issue-to-patch repair. Every stage must compile and pass hidden tests before widening scope. Current documentation/retrieval support should be measured separately from learned code correctness.

The practical laptop-first target is a narrow TypeScript coding agent. A general Copilot/Codex-level model likely requires much larger legally usable corpora, models and compute than the current M3/two-hour-run policy. If local experiments cannot meet frozen quality gates, retain the architecture and evidence, report the limit, and revisit compute/model strategy explicitly rather than weakening evaluation.

## Future task candidates

After the current foundation, propose shared research planning/source comparison, coworker task state/tool execution, domain evaluation and reviewed feedback workflows alongside the coding milestones below. Medical research begins with a narrow use-case/source/evaluation proposal. These are future task candidates; this roadmap update does not approve their implementation.

Reserve identifiers only when tasks are formally proposed; do not infer approval from this list. Candidate sequence after current tasks: code-source governance/ingestion → code corpus → tokenizer/context → coding-model experiments → code benchmark → repository-agent expansion → code RAG → continual-learning governance. Each task must be created under Proposed with linked requirements, measurable gates, laptop impact and source authority before implementation.

## Revisit trigger

Revisit after TASK-018 is verified, or earlier only if the owner explicitly changes the current execution order. At that point assess what the custom model actually achieved, available local resources, repository/licence targets and whether “owned model only” remains a firm constraint. Convert the first bounded milestone into requirements and proposed tasks; do not approve the entire program as one experiment.
