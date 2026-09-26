# Tasks

## Task lifecycle
`PROPOSED -> APPROVED -> IN_PROGRESS -> IMPLEMENTED -> VERIFIED`

Alternative: `BLOCKED`, `CANCELLED`.

## Git lifecycle
Track Git state separately from task state:

`NOT_STARTED -> BRANCH_CREATED -> CHANGES_UNCOMMITTED -> COMMITTED -> PUSHED -> MERGED`

A task may be `VERIFIED` while Git is only `COMMITTED`; verification does not imply merge.

Only tasks under `Approved/` may authorize implementation.

Every task should reference:
- requirement(s);
- related finding(s);
- architecture decision(s), when applicable;
- scope;
- out-of-scope items;
- acceptance criteria;
- verification expectations;
- base branch;
- task branch;
- Git status;
- commit hash when committed;
- acceptance evidence when verified.

Use `Documentation/Templates/TASK-TEMPLATE.md` for new tasks.

## Current task register — 2026-09-27

Completed records remain in Approved/ to preserve existing references; Completed/ is not a second source of truth. Historical verification counts are retained; current baseline is 51 tests.

| Task | Status | Next action |
| --- | --- | --- |
| [TASK-001](Approved/TASK-001-first-grounded-vertical-slice.md) | VERIFIED / delivered | Maintain regression coverage; see technical handover in record |
| [TASK-002](Approved/TASK-002-bootstrap-typescript.md) | VERIFIED / delivered | Maintain regression coverage; see technical handover in record |
| [TASK-003](Approved/TASK-003-governed-ingestion.md) | VERIFIED / delivered | Maintain regression coverage; see technical handover in record |
| [TASK-004](Approved/TASK-004-lexical-retrieval.md) | VERIFIED / delivered | Maintain regression coverage; see technical handover in record |
| [TASK-005](Approved/TASK-005-custom-transformer.md) | VERIFIED / delivered | Maintain regression coverage; see technical handover in record |
| [TASK-006](Approved/TASK-006-grounded-rag.md) | VERIFIED / delivered | Maintain regression coverage; see technical handover in record |
| [TASK-007](Approved/TASK-007-read-only-agent-evaluation.md) | VERIFIED / delivered | Maintain regression coverage; see technical handover in record |
| [TASK-008](Approved/TASK-008-training-design.md) | VERIFIED / delivered | Maintain regression coverage; see technical handover in record |
| [TASK-009](Approved/TASK-009-training-kernels.md) | VERIFIED / delivered | Maintain regression coverage; see technical handover in record |
| [TASK-010](Approved/TASK-010-causal-decoder.md) | VERIFIED / delivered | Maintain regression coverage; see technical handover in record |
| [TASK-011](Approved/TASK-011-training-loop.md) | VERIFIED / delivered | Maintain regression coverage; see technical handover in record |
| [TASK-012](Approved/TASK-012-checkpoints-generation.md) | APPROVED / not started | Checkpoint/resume → generation → held-out gates |
| [TASK-013](Approved/TASK-013-internet-knowledge.md) | VERIFIED / delivered | Maintain regression coverage; see technical handover in record |
| [TASK-014](Proposed/TASK-014-persistent-rag.md) | PROPOSED / needs approval | Connect persistent knowledge to grounded prompts |
| [TASK-015](Proposed/TASK-015-knowledge-operations.md) | PROPOSED / needs approval | Govern source refresh and persistent lifecycle |
| [TASK-016](Proposed/TASK-016-domain-dataset-evaluation.md) | PROPOSED / needs approval | Curate a licensed domain dataset and evaluation |
| [TASK-017](Proposed/TASK-017-learned-grounded-inference.md) | PROPOSED / needs approval | Integrate learned generation behind the RAG boundary |
| [TASK-018](Proposed/TASK-018-application-agent-safety.md) | PROPOSED / needs approval | Design and gate application-building workspace actions |

Read [technical handover](../SessionMemory/TECHNICAL-HANDOVER.md) before resuming. TASK-013 was deliberately implemented before TASK-012. New proposals do not inherit prior blanket approval.
