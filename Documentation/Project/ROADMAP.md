# Remaining roadmap — from websites to learned explanations

Status: TASK-015–020 explicitly approved for implementation. TASK-015 and TASK-016 are verified; see session memory for Git closeout. Approval does not bypass source rights, laptop-only compute limits, quality gates or workspace-action permissions.

## Goal and current baseline

Accept a user-selected eligible website, store attributable knowledge, train our own TypeScript model on separately approved content, and produce useful learned explanations grounded in retrieved evidence. Controlled application building is a subsequent capability.

TASK-001–016 are verified. Eligible single HTML pages can be registered after review, previewed, stored and queried with source-backed templates. The custom model now has reviewed immutable snapshots and supervised recorded jobs, demonstrated on original application-architecture examples. Neither path is yet useful general-domain learned explanation. See the [ingestion guide](../Knowledge/SOURCE-OPERATIONS.md) and [training guide](../Training/JOBS.md).

## Execution order and deliverables

Task numbers are stable identifiers, not execution order:

**015 → 016 → 019 → 020 → 017 → 018**

| Task | Deliverable | Completion evidence |
| --- | --- | --- |
| [015: website onboarding/operations](../Tasks/Approved/TASK-015-knowledge-operations.md) | Submit an eligible HTML URL, review rights/profile, register without code edits, ingest/refresh/withdraw | Reopened DB answers with provenance; pending/denied sources and private-network bypass fixtures blocked; recovery tests pass |
| [016: datasets and training jobs](../Tasks/Approved/TASK-016-domain-dataset-evaluation.md) | Explicit knowledge-version export, immutable manifests/splits, run registry and bounded job lifecycle | Repeatable snapshot hashes, source lineage, restart/resume/cancel tests, candidate checkpoint and recorded metrics |
| [019: model capability](../Tasks/Approved/TASK-019-model-capability.md) | Benchmark current model, justify context/data/architecture/compute, train/evaluate reviewed candidates | Frozen realistic benchmark and human-scored capability gate; report failure as no-go rather than promising useful answers |
| [020: checkpoint promotion](../Tasks/Approved/TASK-020-checkpoint-promotion.md) | Accept/reject candidates, atomically select active model, rollback | Failed candidates cannot promote; pointer failure recovery and output-reproducible rollback |
| [017: learned grounded explanations](../Tasks/Approved/TASK-017-learned-grounded-inference.md) | Accepted model generates explanations using retrieved evidence | Reviewed correctness/support/uncertainty gates, model/evidence identity, stale/invalid-citation rejection |
| [018: controlled app changes](../Tasks/Approved/TASK-018-application-agent-safety.md) | Reviewed workspace diffs and bounded test execution | Independent tests on three disposable application fixtures; permission/escape/recovery checks |

TASK-019 establishes capability before TASK-017 integration. TASK-020 does not manufacture quality: it enforces the reviewed acceptance policy. Infrastructure can be implemented while capability remains blocked by inadequate data or compute.

## Separate the two paths

Approved website content → versioned knowledge DB → retrieval is the immediate-search path.

Selected training-approved document versions → reviewed immutable dataset → explicit training job → candidate checkpoint → evaluation/review/promotion → learned inference is the learning path.

A refresh does not automatically retrain or promote a model. Withdrawing source text blocks future use/exports under policy and triggers checkpoint review; it does not erase knowledge from trained weights.

## Proposed quality targets

Before experiments, approve the task-level rubric and thresholds: at least 20 explanation cases plus 10 insufficient/conflicting-evidence cases; >=80% explanation cases at >=5/6 with no zero correctness score; >=90% appropriate uncertainty on insufficient cases; TASK-017 additionally targets >=95% supported material claims. Deterministic safety/schema/citation tests must all pass. These small-benchmark targets are provisional acceptance criteria, not guarantees across arbitrary websites or domains.

Freeze splits before training, select on validation, and evaluate the sealed test once after candidate selection. Never relax thresholds or repeatedly tune against test results to make a run pass.

## Owner decisions still required

1. First narrow technology domain and example sources. Start with ordinary HTML; PDFs/rendered sites need separate extraction tasks.
2. Retrieval versus training reuse evidence, source-review authority and withdrawal/retention policy.
3. Resource policy is now specified in [TRAINING-BUDGET.md](TRAINING-BUDGET.md): local MacBook Pro M3, 18 GB RAM, 512 GB total storage, no paid cloud and at most two hours/run. Calibrate the proposed 6 GiB RSS cap and choose the free-disk reserve from actual laptop measurements before larger runs.
4. Benchmark questions/reference evidence, human reviewer and predeclared acceptance rubric.
5. Training registry schema/storage ADR and manual job/promotion workflow. A separate logical registry is planned; exact DB architecture is not silently finalized here.
6. Workspace/tool permissions only when considering TASK-018.

## Definition of goal achieved
The broader goal, clarified on 2026-10-03, is an application for building and improving an owned model that works as a coworker across coding and research, including medical research. The [future coworker roadmap](FUTURE-CODING-AGENT-ROADMAP.md) records shared research/tool capabilities, domain-specific evaluation, medical research boundaries and reviewed continual improvement. These future tracks do not change the current approved execution order.


Demonstrate one reproducible end-to-end run: submit and approve an eligible source, retrieve it, export approved versions, train within budget, accept a checkpoint using frozen evaluation, and answer new questions with useful learned explanations and supported citations. TASK-018 additionally demonstrates safe tested application changes if that capability is in scope.

The number of completed tasks is not the success criterion. If model quality fails, record the evidence and seek approval for a new data/architecture/compute experiment.

Next action: implement approved TASK-019 using project-development. Application architecture, the original corpus and the 30-case rubric are frozen; evaluate capability honestly before selecting improvements. The initial loss-test split has already been inspected once, so do not silently reuse it for candidate tuning. See [technical handover](../SessionMemory/TECHNICAL-HANDOVER.md) for code and preservation instructions.
