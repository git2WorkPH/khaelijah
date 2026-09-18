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
