# TASK-018 — Design and gate application-building workspace actions

Task Status: PROPOSED
Git Status: NOT_STARTED

## Authorization

New technical follow-on documented for handover. Not implementation approval; request owner approval before moving to Approved/.

## References and dependencies

REQ-PROD-001; REQ-FND-001; ADR-001; ADR-002 where persistent knowledge is involved.
Dependencies: TASK-017 quality gates; separate explicit approval of write/execution capabilities.

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
- [ ] Run pnpm test, pnpm typecheck, pnpm lint and git diff --check; save task-specific acceptance evidence with exact commands/results.

## Out of scope

Immediate unrestricted shell/filesystem access, production deployment and medical application claims.

## Git and resume

Base: master. Planned branch: task/TASK-018-application-agent-safety. Commit: none. No implementation performed. First action: obtain approval, review dependencies/current code, then refine interfaces and tests before coding.

See [technical handover](../../SessionMemory/TECHNICAL-HANDOVER.md). New risks or expanded scope need their own decision/task, not silent implementation.
