# Architecture

JC Model has four deliberately separate planes:

```text
User request
    |
Application-building agent ---- policy / approval boundary
    |                                      |
    +--> retrieval request --> knowledge layer --> governed sources + indexes
    |                                |
    +------ evidence + provenance ---+
    |
Custom TypeScript Transformer --> grounded response / plan / proposed change
```

- The **model plane** owns tokenization, model configuration, training/inference, and evaluation of learned capabilities.
- The **knowledge plane** owns acquisition, normalization, chunking, metadata, indexing, refresh, retrieval, and citation/provenance.
- The **agent plane** owns task decomposition, tool policy, user approvals, workspace isolation, and action logs.
- The **evaluation plane** measures each plane separately and the complete vertical slice.

The first implementation must use narrow interfaces so the embedding model, vector store, source connector, or Transformer implementation can change independently. See `Decisions/ADR-001-knowledge-layer-separation.md`.
