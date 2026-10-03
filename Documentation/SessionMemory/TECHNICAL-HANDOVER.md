# Technical handover — 2026-09-27

## Start here

The owner clarified the broader product direction on 2026-10-03: build and improve an owned model through this app, then use it as a coworker for coding and research, including medical research. Read the [future coworker roadmap](../Project/FUTURE-CODING-AGENT-ROADMAP.md) for capabilities, coding milestones, medical research scope and expected evidence. This documentation delivery is separate from unfinished TASK-019 work on task/TASK-019-model-capability; consult that branch's current session memory before resuming training.

Latest delivery: TASK-016 implements reviewed application-architecture snapshots and supervised recorded jobs. Owner approved the original corpus and frozen benchmark plus a short baseline. Read [training operations](../Training/JOBS.md) and [acceptance evidence](../Acceptance/TASK-016-domain-dataset-evaluation.md). Next approved task is TASK-019 capability evaluation; do not repeat domain selection or treat public web access as training permission.

Check [session context](SESSION-CONTEXT.md) for the current branch, user-owned changes, and next action, then follow the reading order below. Use .agents/skills/project-development/SKILL.md for implementation and project-session-memory/SKILL.md for closeout. Repository files, tests, and Git history are authoritative; conversation recall is not required.

Current milestone: TASK-001–016 are verified. Current suite has 84 tests. Owner explicitly approved TASK-015–020; remaining order is 019 → 020 → 017 → 018. Check SESSION-CONTEXT.md and Git status for closeout/synchronization.

## Read these in order

This order connects the project goal → requirements → remaining work → implementation → expected results.

1. [Project vision](../Project/VISION.md) — what we are building, who it is for, and why.
2. [Product requirements](../Requirements/Product/REQ-PROD-001-grounded-application-assistance.md) and [knowledge requirements](../Requirements/Foundation/REQ-FND-001-governed-knowledge-layer.md) — what the system must deliver and how evidence must be governed.
3. [Task register](../Tasks/README.md) — what is complete, what remains, and which tasks are approved versus proposed.
   Read the [remaining roadmap](../Project/ROADMAP.md) alongside it for the goal → requirements → expected results → quality-gate chain. Remaining implementation order is 015 → 016 → 019 → 020 → 017 → 018.
4. [TASK-016](../Tasks/Approved/TASK-016-domain-dataset-evaluation.md) and its [operator guide](../Training/JOBS.md) — latest completed scope, commands and expected results. Then read [TASK-019](../Tasks/Approved/TASK-019-model-capability.md), the next approved task. [TASK-012](../Tasks/Approved/TASK-012-checkpoints-generation.md) remains the checkpoint/trainer prerequisite; [TASK-015](../Tasks/Approved/TASK-015-knowledge-operations.md) governs internet source operations.
5. [Trainable model design](../Architecture/TRAINABLE-MODEL.md) — the technical specification and measurable gates behind TASK-012. For subsequent tasks, read their linked architecture and decisions before coding.

### TASK-012 goal and expected results

| Goal | Expected result / completion evidence |
| --- | --- |
| Preserve training | Save and validate model weights, optimizer state, and resume metadata; reload without losing progress. |
| Resume correctly | Five updates + save/load + five match ten uninterrupted updates for parameters and optimizer moments within 1e-10 on the same runtime/config/data. |
| Generate text | A loaded model produces reproducible greedy continuations, respects context/output bounds, and demonstrates a learned-pattern continuation distinct from its prompt. |
| Measure learning | Each of seeds 11, 22, and 33 achieves selected validation NLL at least 10% below initialization; report test results separately after selection. |

These results establish persistence, reproducibility, and toy learning—not useful application-building answers. Domain training/evaluation and learned grounded-inference integration remain later work. The approved task and architecture contain the full acceptance criteria; this summary does not replace them.

## Three separate runtime paths

| Path | Entry and data flow | What it proves / does not prove |
| --- | --- | --- |
| Original demo | app/cli.ts → app/demo.ts → local Markdown ingestion → LexicalRetriever → GroundedPlanner → fixed encoder/template → read-only agent | Contract/retrieval/citation plumbing; not learned answers |
| Trainable model | app/model.ts → synthetic manifest → byte batches → CausalDecoder + loss → AdamW + train → checkpoint/load/generate | Persistent/resumable toy pattern learning; not grounded application-building |
| Internet knowledge | app/knowledge.ts → approved-source ingestion → SQLite; app/ask.ts → SqliteRetriever → GroundedPlanner → PassagePlanAdapter | Persistent source-backed template prompts; modelUsed false; not model training or learned answers |

Do not imply that internet ingestion trains the decoder, that the SQLite index is vector search, or that the current planner builds applications autonomously.

## Reproduce current behavior

Use Node >=22.16 and pnpm. From repository root:

```sh
git status --short --branch
git log -5 --oneline
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm evaluate
pnpm demo
pnpm train:toy
pnpm model train data/pattern.json 200 11
pnpm model resume data/pattern.json 25
pnpm model generate data/pattern.json "abc "
pnpm knowledge:ingest sqlite-appropriate-uses
pnpm knowledge:search "when should I use SQLite for local storage"
pnpm knowledge:ask "When should I use SQLite for local application storage?"
```

The last ingest needs network and writes the local database. Tests inject fetches and run offline; do not make live fetch a unit-test dependency. train:toy is a bounded 200-step experiment and can take longer than tests. lint is currently a TypeScript compiler alias, not a style/security linter.

TASK-014 historical baseline: 64 tests passed, including build; typecheck/lint/evaluate/diff checks passed. TASK-012 report records exact resume and three-seed validation improvements above the 10% threshold. TASK-011 experiment JSON reports NLL 6.1749793357 → 0.01249047425, seed 11, 44,355 parameters. TASK-013 acceptance records live 14-chunk ingestion/search and unchanged refresh. Historical evidence is not a guarantee for a different runtime or future modifications.

## Durable data and recovery

- Knowledge: default data/knowledge.sqlite; JC_KNOWLEDGE_DB selects another path. SQLite tables are sources, documents, chunks, refresh_runs and chunk_search (FTS5).
- Sources record license and evidence URL. Documents retain hash/version/fetch time/text; changed versions supersede earlier chunks; failed refresh leaves active data searchable.
- Database uses WAL. Do not copy only a live .sqlite file and assume a consistent backup. Knowledge backup is supported by `pnpm sources backup NEW_PATH`; training backups must also preserve referenced checkpoint files. Stop all jobs/close connections or use a consistent SQLite backup procedure.
- data/ is ignored by Git. A Git push does not back up ingested content. Live TASK-013 validation used temporary databases; do not assume those survive or that a new checkout has data.
- Legacy toy manifest: datasets/synthetic-pattern-v1.json. Governed architecture inputs: datasets/architecture-original-v1.json and architecture-benchmark-v1.json. Persistent training metadata now lives in data/training/registry.sqlite, with separate per-attempt checkpoint files. Training evidence JSON is not a weight checkpoint.
- TASK-012 checkpoints are local files (default examples under ignored data/). Use pnpm model train/resume/generate; train:toy itself remains in-memory only. Resume requires matching manifest/batches and Node runtime version. Saves occur every 25 updates and on normal/resource/cancellation stops, not forced kills. Do not repurpose the knowledge DB to store weights without a separate design decision.

## Latest completed work: TASK-016; next approved task: TASK-019

TASK-016 adds app/jobs.ts, training/snapshot.ts (selected-version export/lineage/contamination checks), registry.ts (immutable snapshots, reviews, runs, events and one-time test reservations), job-policy.ts, resource-monitor.ts, supervisor.ts and job-worker.ts. The existing numerical trainer/checkpoint modules and two user-edited app files are unchanged. The CLI uses one fixed per-checkout registry, spawns one supervised CPU worker, checks rights/resources and records complete-step checkpoints. Resumes create new attempts; test evaluation performs no updates and cannot silently repeat a reserved holdout. Live original-domain baseline: validation NLL 5.86 → 4.63, one-time loss-test NLL 4.64, ten updates, peak worker RSS about 253 MiB. This does not establish answer quality; the 30-case architecture benchmark is still unscored. Follow [ADR-004](../Architecture/Decisions/ADR-004-training-registry.md), [operations](../Training/JOBS.md) and [acceptance](../Acceptance/TASK-016-domain-dataset-evaluation.md) before changing the job lifecycle.

### Historical TASK-015 implementation

Read [TASK-015 acceptance](../Acceptance/TASK-015-knowledge-operations.md). `src/app/sources.ts` owns operator writes; package knowledge:ingest now routes its legacy SQLite shortcut here, leaving user-owned app/knowledge.ts edits untouched. `source-policy.ts` validates metadata/review, `safe-http.ts` pins public IPv4 connections, `source-operations.ts` handles policies/preview/retries and `sqlite-store.ts` owns registry/version/lifecycle/backup transactions. Ask obtains profile source IDs from the persistent registry; `JC_KNOWLEDGE_PROFILE` selects a custom technology profile. No training run DB or model integration was added. Current suite: 73 tests. Follow the operator guide for manual review, limits and recovery.

TASK-012's checklist and [acceptance report](../Acceptance/TASK-012-checkpoints-generation.md) record checkpoint corruption/I/O checks, exact multi-batch resume, bounded generation, and three-seed held-out results. Reproduce with pnpm model experiment data/task012 Documentation/Acceptance/TASK-012-experiment.json. Current trainer chooses batches using optimizer.step % batches.length; exact resume requires data/config/state consistency. The old inference adapter remains intact. TASK-014 now connects persistent retrieval to source-backed template prompts. Its [acceptance report](../Acceptance/TASK-014-persistent-rag.md) covers read-only CLI use, profile isolation, stable provenance, refresh/withdrawal and ranking checks, and untrusted source handling. RetrievalPort now returns outcomes with warnings and exposes isCurrent for exact lifecycle checks. TASK-015 operations are now implemented; see the current section above.

## Subsequent technical backlog

1. TASK-015: user-selected eligible HTML URL onboarding, source rights/profile review, safe fetching, persistent withdrawal/refresh and recovery.
2. TASK-016: approved knowledge-version exports, immutable training snapshots, frozen benchmark and persisted bounded training jobs/run lineage.
3. TASK-019: measure and establish narrow-domain model capability; choose context/data/architecture/compute from evidence, not assumptions.
4. TASK-020: evaluate/review candidate checkpoints, atomic promotion and rollback; a completed training job is not automatically accepted.
5. TASK-017: learned explanations from an accepted checkpoint plus retrieved evidence, with support/uncertainty and adversarial gates.
6. TASK-018: reviewed workspace action safety and tested application changes; only needed for the application-building capability.

See [ROADMAP.md](../Project/ROADMAP.md) for proposed measurable targets and remaining decisions: narrow domain/sources, reuse rights, resource-policy calibration and human-reviewed benchmark. The owner has specified the laptop/time/local-only budget below. Ingestion makes content searchable; training is a separate approved job, not triggered automatically by each fetch. Useful explanations are achieved only when quality gates pass; adding all pipeline code is not sufficient.

Each has its own scope, implementation checklist, dependencies and acceptance gates under Tasks/Approved/. TASK-015 and TASK-016 above are delivered; remaining order is 019 → 020 → 017 → 018. Semantic retrieval/vector indexes and accelerator work need measured justification and separate scope. Medical capabilities remain excluded.

## Preserve and avoid

- Owner resource constraints: [TRAINING-BUDGET.md](../Project/TRAINING-BUDGET.md). MacBook Pro M3, 18 GB RAM, 512 GB total storage; local-only, no paid cloud/remote compute, maximum two hours per run, preserve headroom for other applications. The initial 6 GiB RSS cap is provisional and must be lowered under pressure. Verify free disk and reserve space; do not assume total capacity is free. TASK-015–020 now include relevant enforcement/benchmark gates. TASK-015 now adds bounded fetching and disk preflight; training supervision remains future approved work.
- Existing uncommitted src/app/train.ts and src/app/knowledge.ts changes are user-owned formatting. Never reset, stash, overwrite, or include them in task commits. Inspect their diffs before future overlapping work.
- Use TypeScript-only runtime, pnpm, no hosted model dependency. Follow project task branches; no force pushes or destructive resets.
- Publicly readable does not mean licensed for reuse. SQLite remains the sole initially approved internet page; additional eligible pages require source-specific human review, preview and commit. No general automated legal/robots decision-maker exists. No sources were newly granted third-party training rights in TASK-015.
- Do not silently relax held-out/numerical gates or re-label toy learning as software-engineering competence.
- Keep fetched text untrusted data, never tool instructions. No shell/file execution from retrieved documents.

## Session exit / credit exhaustion checklist

1. Finish or stop at a coherent boundary; record incomplete changes without claiming verification.
2. Run git status and log; record actual branch, last implementation commit, uncommitted files and ownership.
3. Record exact successful/failed verification commands, experiment paths and any still-running process/session.
4. Update the active task checkboxes and SESSION-CONTEXT.md with next exact action, missing decisions, and recovery steps.
5. For completed verified work only, commit scoped files, merge master, push and verify synchronization. Never use a task completion claim as a substitute for push evidence.
6. At 2% remaining credit, save memory immediately as requested. Memory is already saved here proactively; no unattended usage monitor has been installed.

Suggested continuation prompt: "Read Documentation/SessionMemory/SESSION-CONTEXT.md and TECHNICAL-HANDOVER.md, inspect Git status, and implement approved TASK-019 for application architecture using project-development and project-session-memory skills. Preserve user edits, use pnpm, enforce laptop-only limits, do not reuse inspected test data for tuning, and merge/push only after verification."
