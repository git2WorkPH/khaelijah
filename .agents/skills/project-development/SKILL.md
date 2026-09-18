# Project Development Skill

Implement exactly one approved task and leave the repository in a deterministic, recoverable state.

## 1. Establish context
1. Read project context.
2. Confirm the task exists under `Documentation/Tasks/Approved/`.
3. Read linked requirements, findings, architecture decisions, and acceptance criteria.
4. Inspect the existing implementation.

## 2. Establish repository state
Before changing files:
1. Run `git status`.
2. Identify the current branch.
3. Read the Git workflow in `Documentation/Project/PROJECT.md`.
4. Identify the configured base branch.
5. Check for existing uncommitted changes.
6. Never discard, overwrite, stash, reset, or commit unrelated existing changes without explicit approval.

If the worktree contains unexplained changes that could conflict with the approved task, stop implementation and report the condition.

## 3. Create or resume the task branch
If a task branch already exists, resume it rather than creating another branch.

If no task branch exists:
1. Switch to the configured base branch.
2. Update it safely according to project policy. Prefer fast-forward-only updates where applicable.
3. Create a dedicated task branch using the configured naming convention.

Example:
`task/TASK-014-password-reset`

Record the branch in the task document and session memory.

## 4. Begin implementation
1. Set task status to `IN_PROGRESS`.
2. Set Git status to `BRANCH_CREATED` or `CHANGES_UNCOMMITTED` as appropriate.
3. Implement only approved scope.
4. Add or update tests.
5. Do not silently implement newly discovered work.

If new work is discovered:
- record a finding;
- create or propose a separate task when appropriate;
- continue only within the current approved scope.

## 5. Verify
Run all verification required by the task and project, including applicable:
- build;
- typecheck;
- lint;
- unit tests;
- integration tests;
- acceptance tests;
- manual validation.

Do not claim verification succeeded unless the commands actually ran and their results are known.

## 6. Review changes before commit
1. Run `git status`.
2. Review `git diff` and staged changes.
3. Confirm every changed file belongs to the approved task.
4. Check each acceptance criterion.
5. Confirm no secrets, credentials, unrelated files, or accidental generated artifacts are included.

## 7. Commit
Commit only files belonging to the approved task.

Use the commit convention configured in `Documentation/Project/PROJECT.md`.

Example:
`feat(auth): implement password reset [TASK-014]`

After committing:
- record the commit hash in the task;
- set Git status to `COMMITTED`;
- record exact verification commands and results.

Do not automatically push, merge, rebase published history, delete branches, or force-push unless project policy and explicit authorization permit it.

## 8. Record implementation
Update the task with:
- implementation summary;
- base branch;
- task branch;
- files changed;
- verification commands;
- verification results;
- commit hash;
- unresolved findings;
- follow-up tasks.

Move or update task state according to project policy.

## 9. Update session memory
Record:
- active/completed task;
- base branch;
- current branch;
- latest commit;
- working-tree state;
- verification state;
- outstanding findings;
- next exact action.

The next session should be able to resume without guessing repository state.
