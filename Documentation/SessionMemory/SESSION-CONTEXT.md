# Project Session Context

## Phase
PROTOTYPE — bounded toy training and curated internet ingestion into SQLite verified.

## Active requirement
REQ-PROD-001; REQ-FND-001

## Active task
None. TASK-013 is verified and merged; documentation closeout and push pending.

## Recent decisions
- ADR-001: separate durable learned model capability from the refreshable knowledge layer.
- TASK-001: first grounded vertical-slice design completed and verified.
- TASK-002 through TASK-007 are explicitly approved. The owner subsequently authorized merging each completed branch into master and pushing verified master to origin. Use pnpm.

## Open findings
- Fixed, untrained encoder weights and a templated recommendation do not demonstrate learned application-building ability.
- Semantic conflict detection and real-domain evaluation remain outstanding. Toy training is implemented; the original demo corpus is synthetic. Internet ingestion is separate from training and generated answers.

## Completed/verified work
- Established project vision, scope, glossary, architecture boundary, requirements, decision record, and proposed first planning task.
- Completed and verified TASK-001 design deliverable.
- TASK-002 through TASK-011 completed: local prototype, causal decoder/backward/loss, synthetic dataset manifests, AdamW, and bounded training. Toy training reduced NLL from 6.1749793357 to 0.01249047425 in 200 steps; weights remain in memory.
- TASK-013 completed ahead of TASK-012 by owner authorization: allowlisted SQLite documentation ingestion, versioned SQLite persistence, refresh auditing, and provenance-bearing FTS5 search. Live ingestion produced 14 chunks; repeat refresh returned unchanged. See Acceptance/TASK-013-live-ingestion.md.

## Repository state
- Base branch: master.
- Current branch: master.
- Latest implementation commit: bba121f (TASK-013); merge: 88e6714. Inspect git log for subsequent documentation closeout.
- Working tree: preserve unrelated existing formatting edit in src/app/train.ts; excluded from task commits.
- Remote sync: push pending at this snapshot; check git status and origin/master on resume.

## Current implementation state
- Last completed step: Verify TASK-013; all 51 tests, build, typecheck and compiler-based lint pass.
- Last verification command: `pnpm test && pnpm typecheck && pnpm lint && git diff --check`.
- Verification result: PASS.

## Resume instructions
- Next exact action: Commit TASK-013 documentation closeout and push master; then read and resume approved TASK-012.
- Files likely involved: TASK-012 record, model checkpoint/generation modules, tests, README.md.
- Do not modify: Preserve src/app/train.ts user edit. Do not add external model services, arbitrary crawling, or write-capable agent tools.

## Next recommended action
TASK-012: checkpoint/resume, generation, and held-out evaluation. Knowledge CLI: `pnpm knowledge:ingest sqlite-appropriate-uses`, then `pnpm knowledge:search "when should I use SQLite for local storage"`. Default database is ignored `data/knowledge.sqlite`; override with JC_KNOWLEDGE_DB. Search returns passages, not generated answers. No scheduled crawling, vector embeddings, or automatic training on ingested text. Standing owner instruction: merge and push each completed task to master after verification.

## Important constraints
- TypeScript-only product runtime.
- Never treat the entire internet as the training corpus or current source of truth.
- Preserve retrieval provenance and source governance.
- Medical capability requires a dedicated safety and governance scope before any implementation.

Session memory summarizes authoritative documents; it does not override them.
