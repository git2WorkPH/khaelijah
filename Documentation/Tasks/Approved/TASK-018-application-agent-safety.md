# TASK-018 — Design and gate application-building workspace actions

Task Status: APPROVED
Git Status: NOT_STARTED

## Authorization

Owner approved implementation of TASK-015–020. Source-specific rights reviews and task safety/quality gates still apply.

## References and dependencies

REQ-PROD-001; REQ-FND-001; ADR-001; ADR-002 where persistent knowledge is involved.
Dependencies: TASK-017 quality gates; separate explicit approval of write/execution capabilities.

Goal: turn a grounded plan into reviewable, bounded application changes. Inputs are an approved workspace, user request, accepted model and permitted tools. Expected outputs are a reviewed diff, test results and action audit; rollback preserves pre-existing user work. This task is not required merely to ingest, train and explain.

## Likely files

src/agent/planning-agent.ts; new action-policy/tool boundary, sandbox and evaluation tests. Paths marked future are proposed, not existing code.

## Technical checklist

- [ ] Begin with an approved safety ADR: workspace allowlist, read/write/execute capabilities, human review points, command/network policy, secrets isolation and recovery semantics.
- [ ] Separate planning from execution; produce previewable patches with expected file hashes and reject stale-workspace conflicts.
- [ ] Implement only approved bounded tool actions with logs, cancellation/time/resource limits and generated-code test verification; retrieved content never grants tool authority.
- [ ] Require explicit permission for destructive changes, dependency installation, external publication and deployment. Preserve dirty worktrees and user changes.
- [ ] Evaluate first in disposable fixture workspaces: malicious source text, path traversal, symlink escape, command injection, secrets, stale files and failed rollback.

## Acceptance and verification

- [ ] Unauthorized filesystem/network/process effects are denied and logged; unit/integration tests exercise escape attempts.
- [ ] User reviews a diff and exact action scope before authorized execution; failure preserves recoverable user data.
- [ ] End-to-end application fixture passes independently specified tests with a clear audit trail; no autonomous production deployment.
- [ ] On at least three approved disposable application fixtures (new feature, bug fix, failing-test recovery), produce a reviewed diff and run independently authored acceptance tests. Record both successes and failures; no benchmark-test modification to manufacture a pass.
- [ ] Run pnpm test, pnpm typecheck, pnpm lint and git diff --check; save task-specific acceptance evidence with exact commands/results.

## Out of scope

Immediate unrestricted shell/filesystem access, production deployment and medical application claims.

## Git and resume

Base: master. Planned branch: task/TASK-018-application-agent-safety. Commit: none. No implementation performed. First action: review completed dependencies/current code, then refine interfaces and tests before coding.

See [technical handover](../../SessionMemory/TECHNICAL-HANDOVER.md). New risks or expanded scope need their own decision/task, not silent implementation.

## Laptop-only implementation constraints

Follow [TRAINING-BUDGET.md](../../Project/TRAINING-BUDGET.md). Owner hardware/time/local-only requirements are firm; the 6 GiB RSS cap is a proposed starting safeguard, not measured safe capacity. Implementation is approved; resource and quality gates still apply.

- [ ] Include tool/test subprocesses in aggregate laptop resource accounting; bound time/memory/concurrency and preserve headroom for other applications. Do not launch training alongside tool execution without a reviewed aggregate budget.
- [ ] Test child-process timeout/cancellation and resource exhaustion preserve user data and logs. No cloud compute or remote execution as an automatic escape from local limits.

## Owner authorization — current

Owner explicitly approved implementation of TASK-015–020 in conversation. This supersedes historical proposed/approval-pending wording above, but not source-specific reuse reviews, capability gates, resource ceilings or workspace-action safety boundaries. Execution order: 015 → 016 → 019 → 020 → 017 → 018. Only TASK-015 is active in this implementation cycle.
