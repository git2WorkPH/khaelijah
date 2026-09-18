# Documentation Guide

`Documentation/` is the authoritative project knowledge base.

```text
Documentation/
├── Project/
│   ├── PROJECT.md
│   ├── VISION.md
│   ├── SCOPE.md
│   └── GLOSSARY.md
├── Requirements/
│   ├── Product/
│   ├── Foundation/
│   └── Features/
├── Assessment/
│   └── Findings/
├── Architecture/
│   └── Decisions/
├── Tasks/
│   ├── Proposed/
│   ├── Approved/
│   └── Completed/
├── Acceptance/
├── SessionMemory/
└── Templates/
```

## Workflow
Requirement -> Assessment -> Finding -> Decision -> Proposed Task -> Approval -> Approved Task -> Git Preparation -> Implementation -> Test -> Review -> Verified -> Commit -> Session Memory -> Merge/Closeout.

## Source-of-truth hierarchy
1. Approved requirements define what the product must do.
2. Approved architecture decisions define accepted constraints.
3. Approved tasks define what may be implemented now.
4. Assessment/findings describe observed reality and risks.
5. Acceptance evidence records whether implemented work meets criteria.
6. Session memory summarizes current state but does not override authoritative documents.

A finding is not a task. A proposed task is not an approved task. A verified task is not necessarily merged.

## Traceability
For implemented work, maintain the chain:

`Requirement -> Finding/Decision -> Task -> Branch -> Commit -> Acceptance Evidence -> Verified Task`
