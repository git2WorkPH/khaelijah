# Project Vision

## Why this project exists
Software builders need an assistant that combines durable engineering reasoning with current, traceable domain knowledge. JC Model is intended to make that capability understandable and controllable: a custom TypeScript Transformer supplies learned reasoning, while a separately operated knowledge layer supplies current evidence at answer time.

## Who it serves
The initial user is the project owner: a developer building applications. Future users may include development teams working in a defined knowledge profile, such as technology or medicine.

## Desired outcome
Given a scoped application request, the system can retrieve relevant, attributable knowledge from an approved corpus, explain the evidence it used, propose an implementation plan, and eventually assist with building and validating the application under explicit human control.

## Product principles
- Keep model parameters and current knowledge separate; update the latter without retraining the former.
- Make retrieval provenance and uncertainty visible to the user and evaluator.
- Prefer a small, measurable end-to-end capability over broad but untestable claims.
- Keep consequential actions—including source ingestion and code changes—within explicit policy and human approval.
