# Project Profile

Status: ACTIVE

## Project name
JC Model

## Project type
Developer-focused AI platform (model runtime, knowledge layer, and application-building agent)

## Product stage
REQUIREMENTS

## Technology stack
- Language: TypeScript (strict mode); no Python runtime in product code.
- Framework: Custom Transformer implementation; framework selection is deferred.
- Platform: Local development first; service deployment later.
- Backend: TypeScript service layer, deferred until the first vertical slice is designed.
- Database: Versioned document store and vector index, implementation deferred.
- Infrastructure: Reproducible local development and evaluation environment.
- Third-party services: None required for the core model path; curated source connectors are deferred.

## Target platforms
- Local development environment
- Server-side runtime (future)

## Current phase
Define the system architecture and first vertical slice.

## Current active task
None. TASK-001 is verified; propose TASK-002 before product implementation.

## High-level repository structure
- `Documentation/` — governed project context, requirements, decisions, tasks, and evidence.
- Product source directories will be introduced only by approved implementation tasks.

## Git workflow

### Repository
- Default/base branch: Unknown (repository metadata is not currently available).
- Integration branch: None.
- Remote: Unknown.
- Task branch required: Yes, once Git is initialized.

### Branch naming
- Task: `task/TASK-ID-short-description`
- Fix: `fix/TASK-ID-short-description`
- Documentation: `docs/TASK-ID-short-description`

Adjust these conventions for the project if needed.

### Commit convention
Default:
`type(scope): description [TASK-ID]`

Examples:
- `feat(auth): add password reset flow [TASK-014]`
- `fix(api): reject expired access tokens [TASK-021]`
- `test(auth): cover reset-token expiry [TASK-014]`
- `docs(project): record authentication decision [TASK-014]`

### Remote and merge policy
- Push task branches automatically: No.
- Pull request required: To be decided when a remote exists.
- Verification required before merge: Yes.
- Merge strategy: Manual.
- Protected branches: [main]
- Branch deletion after merge: [MANUAL / ALLOWED]

Unless explicitly configured otherwise, development may create a local task branch and commit approved work, but pushing and merging require explicit authorization.

## Project constraints
- The custom Transformer, retrieval system, and agent are separate subsystems with explicit interfaces.
- The model must not depend on training over the entire internet to stay current.
- The knowledge layer must preserve source, retrieval time, version, and access/licensing metadata.
- A technology or medical corpus must be selected per knowledge profile; medical output must not be represented as clinical diagnosis or treatment advice without separate safety work.
- Product runtime code is TypeScript-only.

## Owner decisions
- Separate durable model capabilities from continuously updated external knowledge (ADR-001).
- Start with an auditable, narrow vertical slice before general-domain ingestion or autonomous application changes.
