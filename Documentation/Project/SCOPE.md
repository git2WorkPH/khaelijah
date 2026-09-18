# Project Scope

## In scope
- A custom Transformer model implemented in TypeScript.
- A continuously refreshable, source-governed knowledge layer.
- Retrieval-augmented generation (RAG) that supplies evidence to model inference.
- An agent workflow that can analyse application requests, create plans, and later propose or perform bounded application-building actions with user approval.
- Evaluation for answer grounding, retrieval quality, and application-building task success.

## Out of scope
- Training on, storing, or continuously crawling the entire public internet.
- Claiming medical diagnosis, treatment, or other regulated professional advice.
- Unbounded autonomous deployment, data exfiltration, or code changes outside an explicitly approved workspace.
- Replacing mature foundation models during the initial prototype; comparative baselines are allowed.

## Future possibilities
- Fine-tuning or continued pre-training on legally usable, curated corpora.
- Additional knowledge profiles, source connectors, and scheduled refresh policies.
- Sandboxed code execution, pull-request workflows, and integrations with developer tools.

## Scope rule
Work outside approved scope must become a finding, requirement, or proposed task. It must not be silently implemented.
