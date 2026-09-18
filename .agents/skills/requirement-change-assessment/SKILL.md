# Requirement Change Assessment & Implementation Skill

Assess the current repository against a new or changed requirement, determine the correct Git branch, propose a scoped implementation plan, and—when implementation is authorized—update production code and tests so the repository reflects the requirement with traceable verification evidence.

This skill is standalone. If an AI Project Continuity Kit is present, integrate with it rather than duplicating its records.

## Core principles

1. Requirements are the source of truth; failing tests are evidence, not requirements.
2. Existing user changes must be preserved.
3. Reuse an existing task branch when it represents the same requirement/ticket.
4. Do not create duplicate branches for the same work.
5. Do not remove a test merely because it fails after a requirement change.
6. A test may be removed only when the old behavior is explicitly obsolete, superseded, or impossible under the new requirement, and the removal rationale must be recorded.
7. Separate assessment/proposal from implementation when authorization to change code is absent.
8. Do not silently expand scope when unrelated defects or opportunities are discovered.

---

# 1. Resolve the requirement source

Accept the requirement from one of these sources, in this precedence order:

1. **Explicit requirement supplied by the user**
2. **Explicit Jira ticket/key supplied by the user**
3. **Current Jira issue explicitly associated with the requested work**, when Jira access is available
4. **Continuity Kit requirement/task records**, when the repository contains them

Do not invent missing requirements from code behavior alone.

For Jira-backed work, retrieve and record when available:
- issue key;
- title/summary;
- description;
- acceptance criteria;
- issue type;
- status;
- parent/epic relationship;
- linked issues that materially constrain the change;
- labels/components if they affect ownership or branch policy.

If Jira cannot be accessed, continue using any requirement details supplied directly by the user and clearly identify Jira-derived information as unavailable.

Create a normalized requirement summary containing:
- Requirement ID / Jira key
- Problem or desired behavior
- Current behavior, if known
- Required behavior
- Acceptance criteria
- Explicitly out-of-scope behavior
- Constraints / compatibility expectations
- Open ambiguities

If an ambiguity prevents safe implementation, stop before modifying code and report the exact ambiguity. Assessment may still continue.

---

# 2. Detect Continuity Kit integration

Check whether the repository contains:

- `AGENTS.md`
- `Documentation/Project/`
- `Documentation/Requirements/`
- `Documentation/Tasks/`
- `.agents/skills/`

If present:
1. Read applicable project context and repository policy.
2. Reuse existing requirement, finding, task, ADR, acceptance, and session-memory records.
3. If the new requirement does not yet have a record, create/propose one according to kit policy.
4. Do not bypass approval gates defined by the kit.
5. Record branch, commit, verification, and test-impact evidence in the corresponding task when implementation is performed.

If the kit is not present, keep the assessment in the response/work log without requiring kit files.

---

# 3. Inspect repository and Git state

Before changing any file, inspect:

```bash
git status --short --branch
git branch --show-current
git remote -v
git log -10 --oneline --decorate
```

Determine:
- current branch;
- configured/default base branch where possible;
- whether the worktree is clean;
- whether local changes are related to this requirement;
- whether local or remote branches already exist for the requirement/ticket.

Never discard, overwrite, stash, reset, clean, commit, or rebase unrelated user changes without explicit authorization.

If unexplained local changes overlap files likely affected by this requirement, stop before modification and report the conflict risk.

---

# 4. Resolve the work branch

Resolve branch identity in this precedence order:

1. Explicit branch supplied by the user
2. Branch explicitly specified in the Jira ticket
3. Existing local branch that clearly matches the Jira key / requirement ID
4. Existing remote branch that clearly matches the Jira key / requirement ID
5. Branch name derived from project policy and Jira key / requirement ID

## Existing-branch detection

Search both local and remote branches. For a Jira key such as `PAY-142`, inspect common patterns including project-configured conventions and variants such as:

- `PAY-142-*`
- `feature/PAY-142-*`
- `feat/PAY-142-*`
- `task/PAY-142-*`
- `fix/PAY-142-*`
- `bugfix/PAY-142-*`

Do not assume a naming convention if project policy defines one.

When exactly one clear matching branch exists, reuse it.

When multiple plausible matching branches exist, do not guess which one owns the work. Report the candidates and stop before branch mutation unless repository history provides unambiguous evidence.

When only a remote branch exists, create a local tracking branch rather than a new independent branch.

## New branch creation

If no branch exists and implementation is authorized:
1. identify the configured base branch;
2. update it safely according to project policy;
3. create a branch using the project's branch convention;
4. include the Jira key / requirement ID in the branch whenever policy allows.

Example:

`feature/PAY-142-support-partial-refunds`

Do not automatically push the branch unless project policy and authorization permit it.

---

# 5. Assess the current code state

Perform a focused codebase assessment before proposing changes.

Inspect:
- entry points relevant to the requirement;
- domain/business logic;
- data models and persistence;
- API/contracts/schema;
- UI behavior if applicable;
- configuration/feature flags;
- error handling;
- observability/logging when requirement-relevant;
- existing tests;
- fixtures/mocks/factories;
- migrations if data shape changes;
- documentation that describes affected behavior.

Trace the current behavior end-to-end where practical.

Produce a **Current State** summary containing:
- where the behavior is implemented;
- how the current flow works;
- existing assumptions;
- relevant dependencies;
- tests that currently protect the behavior;
- gaps between current and required behavior.

Do not infer that code is correct merely because tests pass.

---

# 6. Build a requirement-to-code impact map

For every acceptance criterion, map:

| Acceptance criterion | Current implementation | Gap | Production files | Existing tests | Required test action |
|---|---|---|---|---|---|
| criterion | present/partial/missing | description | files/modules | tests | keep/add/update/remove |

Classify each affected behavior as:
- `UNCHANGED`
- `MODIFIED`
- `NEW`
- `DEPRECATED`
- `REMOVED`
- `UNCLEAR`

Identify backward-compatibility impacts explicitly.

---

# 7. Propose scoped changes

Before implementation, produce a proposed change set containing:

## Production changes
For each proposed production change:
- file/module;
- behavior being changed;
- reason linked to an acceptance criterion;
- migration/compatibility implications;
- risk level.

## Test changes
Classify every test action:

### KEEP
Existing test remains valid and should continue passing unchanged.

### ADD
No adequate test exists for new behavior. Add a test covering the requirement and edge cases.

### UPDATE
Existing behavior intentionally changes. Update the test's inputs/expectations while preserving useful coverage.

### REMOVE
Use only when the behavior asserted by the test is explicitly removed or superseded by the requirement.

A removal proposal must include:
- exact test being removed;
- old behavior it asserted;
- requirement/acceptance criterion that invalidates that behavior;
- replacement coverage, when applicable.

Never classify a test as `REMOVE` solely because:
- it currently fails;
- implementation is inconvenient;
- the test appears old;
- the test duplicates implementation details but still protects valid behavior.

### SPLIT / REFACTOR
Use when one test mixes old and new behavior or is too broad to express the new acceptance criteria safely.

---

# 8. Implementation authorization gate

If the request is assessment/review only:
- stop after proposed changes;
- do not modify production code or tests;
- do not create commits.

If the user explicitly requested implementation, or an approved Continuity Kit task authorizes implementation:
- proceed with production and test changes.

If Continuity Kit policy requires task approval, that approval remains mandatory even if this skill has enough technical information to implement.

---

# 9. Implement production changes

When authorized:
1. make the smallest coherent change that satisfies the requirement;
2. preserve unaffected behavior;
3. avoid unrelated cleanup/refactoring unless necessary for the requirement;
4. record newly discovered unrelated issues as findings/follow-ups rather than silently fixing them;
5. update contracts, migrations, docs, or configuration when the requirement depends on them.

After meaningful edits, inspect the diff to ensure changes remain in scope.

---

# 10. Add, update, or remove tests

Tests must reflect requirement intent, not implementation convenience.

## Add tests for
- each new acceptance criterion;
- new success paths;
- new failure paths;
- boundary/edge cases implied by the requirement;
- regression cases for the behavior being changed;
- compatibility expectations where relevant.

## Update tests when
- expected behavior has intentionally changed;
- inputs/contracts changed;
- fixtures no longer represent valid domain state;
- existing test coverage remains conceptually valid but assertions need to match the new requirement.

## Remove tests only when
- the asserted behavior is explicitly removed/deprecated/superseded; and
- keeping the test would require preserving behavior the new requirement says must no longer exist.

Before removal, check whether useful portions should be retained as a new or refactored test.

When a test is removed, record the rationale in the implementation/task notes.

---

# 11. Verify the complete behavior

Run the narrowest relevant tests first, then project-level verification required by repository policy.

Applicable checks may include:
- unit tests;
- integration tests;
- contract/API tests;
- end-to-end tests;
- typecheck;
- lint;
- build;
- migrations/schema validation;
- manual acceptance validation.

Record exact commands and results.

Do not report `PASS` for a command that was not executed.

If unrelated pre-existing failures exist, distinguish them from failures introduced by the requirement change.

---

# 12. Review the diff against requirements

Before commit or final report:

1. inspect `git status`;
2. inspect the full diff;
3. map every changed file back to at least one requirement criterion or necessary support change;
4. confirm unrelated files were not modified;
5. confirm tests cover all changed behavior;
6. confirm removed tests have documented requirement justification;
7. confirm acceptance criteria are either verified or explicitly blocked.

---

# 13. Commit and traceability

If implementation is authorized and project policy permits committing:
- stage only in-scope files;
- use the repository's commit convention;
- include Jira key / requirement ID when convention supports it;
- record commit hash.

Example:

`feat(refunds): support partial refunds [PAY-142]`

Do not automatically:
- force push;
- delete branches;
- merge to protected branches;
- rewrite published history;
- squash/rebase shared work;
- push when authorization/policy is absent.

When Continuity Kit is present, update:
- approved task;
- acceptance evidence;
- findings/decisions if required;
- session memory;
- Git status and commit hash.

---

# 14. Required output

Whether assessment-only or implementation, report:

## Requirement
- Source: explicit / Jira / Continuity Kit
- ID/key
- Normalized requirement
- Acceptance criteria

## Git
- Base branch
- Current branch
- Matching branch discovered: yes/no
- Branch action: reused / tracking remote / created / none
- Worktree safety status

## Current state
- Relevant implementation summary
- Existing test coverage
- Requirement gaps

## Proposed / implemented changes
- Production files and rationale
- Test actions: KEEP / ADD / UPDATE / REMOVE / SPLIT
- Compatibility or migration impact

## Verification
- Commands executed
- Results
- Acceptance-criterion status

## Traceability
- Requirement/Jira key
- Continuity Kit task, if any
- Branch
- Commit hash, if any
- Follow-up findings/tasks

---

# 15. Suggested execution sequence

Use this sequence as the default mental model:

```text
Requirement source (explicit or Jira)
        ↓
Normalize acceptance criteria
        ↓
Read project / Continuity Kit policy
        ↓
Inspect Git + current branch/worktree
        ↓
Find existing Jira/requirement branch
        ↓
Reuse branch OR safely create branch
        ↓
Assess current implementation + tests
        ↓
Requirement-to-code/test impact map
        ↓
Proposed scoped changes
        ↓
Authorization / task approval gate
        ↓
Implement production changes
        ↓
KEEP / ADD / UPDATE / REMOVE tests
        ↓
Run verification
        ↓
Review diff against requirements
        ↓
Commit + traceability
        ↓
Continuity/session handoff
```
