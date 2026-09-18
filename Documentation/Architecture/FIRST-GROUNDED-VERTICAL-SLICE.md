# First Grounded Vertical Slice

Status: IMPLEMENTATION-READY DESIGN  
Authorizing task: TASK-001  
Requirements: REQ-PROD-001, REQ-FND-001  
Decision: ADR-001

## Purpose

This design defines the smallest useful, local implementation of JC Model. A developer asks a technology-focused application-building question. The system searches a deliberately small, governed local corpus, packages selected passages with provenance, sends that evidence to a TypeScript Transformer inference boundary, and returns a reviewable implementation plan with evidence separated from recommendations.

It is a single-profile, read-only workflow. It neither accesses the internet nor changes a user workspace.

## User-visible flow

```text
Scoped developer request
  -> request validation and task framing
  -> retrieve ranked active passages from the technology profile
  -> build an evidence packet with provenance
  -> custom Transformer inference boundary
  -> sourced implementation plan or an explicit insufficient-evidence result
```

The response must contain these sections in a structured form:

1. `taskSummary` — restatement of the requested application work.
2. `evidence` — selected passages, source identity, and retrieval metadata.
3. `recommendations` — model-generated plan, explicitly labelled as recommendations.
4. `uncertainties` — missing, weak, or conflicting evidence and proposed next research steps.

No response may present a recommendation as a fact supplied by the corpus.

## Initial knowledge profile and corpus

The first knowledge profile is `technology-typescript-web`. It contains 12–20 short, reviewed Markdown documents on stable software-engineering topics: TypeScript input validation, error handling, HTTP APIs, authentication boundaries, testing, dependency injection, observability, and deployment checklists.

Each document uses front matter and body content:

```yaml
id: tech-ts-validation-001
title: Validate inputs at the service boundary
sourceUrl: https://example.invalid/internal/validation-guide
publisher: JC Model evaluation corpus
license: Internal evaluation content
publishedAt: 2026-09-19
refreshPolicy: manual
status: active
```

The document body is split into stable chunks. The demonstration corpus is local, hand-curated, and version-controlled. `sourceUrl` is an identity field only in the initial slice; no network fetch is performed.

## Module boundaries

The eventual source layout is intentionally feature-oriented and TypeScript-only:

```text
src/
  core/                 shared result, ID, clock, and error types
  knowledge/
    profile/            profile and source governance
    ingest/             parse, validate, chunk, lifecycle handling
    retrieval/          lexical ranking and retrieval port
  model/                tokenizer, Transformer, and inference port
  rag/                  evidence packet construction and response validation
  agent/                request framing and plan orchestration
  evaluation/           fixtures, runners, and metrics
  app/                  local CLI or HTTP composition root
corpus/
  technology-typescript-web/
evaluation/
  technology-typescript-web/
```

Dependencies flow inward. `app` composes ports and adapters; `agent` depends on the `rag` and retrieval interfaces; `rag` depends on an inference port; and storage/indexing implementations depend on the knowledge contracts. Neither the Transformer nor the agent directly reads corpus files.

## TypeScript contracts

The following are the stable contracts to introduce in the first implementation. Exact utility types may vary, but their information content must not.

```ts
type IsoInstant = string;
type SourceId = string;
type DocumentId = string;
type ChunkId = string;
type ProfileId = string;

type LifecycleStatus = "active" | "superseded" | "withdrawn";

interface KnowledgeProfile {
  id: ProfileId;
  name: string;
  domain: "technology";
  allowedSourceIds: SourceId[];
  retrievalPolicy: { maxResults: number; minScore: number };
}

interface SourceRecord {
  id: SourceId;
  title: string;
  canonicalUrl: string;
  publisher: string;
  licenseOrAccess: string;
  publishedAt?: IsoInstant;
  registeredAt: IsoInstant;
  refreshPolicy: "manual";
  lifecycle: LifecycleStatus;
}

interface KnowledgeChunk {
  id: ChunkId;
  profileId: ProfileId;
  documentId: DocumentId;
  sourceId: SourceId;
  text: string;
  ordinal: number;
  contentHash: string;
  lifecycle: LifecycleStatus;
  ingestedAt: IsoInstant;
}

interface RetrievalQuery {
  profileId: ProfileId;
  query: string;
  limit: number;
  retrievedAt: IsoInstant;
}

interface RetrievedPassage {
  chunk: KnowledgeChunk;
  score: number;
  rank: number;
  source: SourceRecord;
  retrievedAt: IsoInstant;
}

interface RetrievalPort {
  retrieve(query: RetrievalQuery): Promise<RetrievedPassage[]>;
}

interface EvidencePacket {
  requestId: string;
  profileId: ProfileId;
  query: string;
  passages: RetrievedPassage[];
  retrievalWarnings: string[];
  createdAt: IsoInstant;
}

interface InferenceRequest {
  task: string;
  evidence: EvidencePacket;
  outputSchema: "grounded-implementation-plan-v1";
}

interface InferencePort {
  generate(request: InferenceRequest): Promise<unknown>;
}
```

The RAG module owns converting the model's untrusted `unknown` output into a validated response. It must reject citation IDs absent from `EvidencePacket.passages` and must not invent source metadata.

## Retrieval, lifecycle, and provenance

The first slice uses deterministic lexical retrieval (BM25 or an equivalent transparent token-score implementation) over active chunks only. This avoids embedding-model selection, remote dependencies, and opaque ranking while still exercising the retrieval contract. A future hybrid/vector implementation must preserve `RetrievalPort` and result metadata.

Ingestion produces an audit record with document identifier, source identifier, content hash, chunk count, status, timestamp, and errors. A document update creates a new active version and marks its former chunks `superseded`; withdrawal marks all relevant chunks `withdrawn`. Default retrieval excludes both statuses. The local corpus's manual refresh command still emits the same audit result required of later scheduled refreshes.

Every passage in an evidence packet retains: chunk ID, document ID, source ID, canonical URL, publisher, license/access context, publication date when known, ingestion time, lifecycle status, score, rank, and retrieval time.

## Model and agent boundary

`InferencePort` represents the custom TypeScript Transformer and must be implemented by the project model module, not by an external hosted model. TASK-001 does not prescribe a completed trained model. During early contract and retrieval tests, a deterministic fixture implementation may be used only as a test double; it cannot be labelled as the product's model capability.

The agent is limited to:

- validate that the request is a scoped application-building question;
- formulate a retrieval query without adding factual claims;
- request evidence and inference;
- return a plan for human review;
- log request, selected evidence IDs, response validation outcome, and warnings.

It has no filesystem-write, shell, git, network, credential, or deployment tools in this slice.

## Failure and conflict behavior

| Condition | Required behavior |
| --- | --- |
| No active passage meets the score threshold | Return `insufficient_evidence`; do not produce an evidence-backed plan. |
| Fewer than the requested number of passages are available | Continue with the available evidence and add an explicit coverage warning. |
| Model output cites an unknown passage | Reject the output as `invalid_citation` and log the validation error. |
| Retrieved sources materially disagree | Return both attributed positions and flag a conflict; do not silently synthesize a single fact. |
| Source is superseded or withdrawn after retrieval | Mark the response stale and require a fresh retrieval before a final result. |
| Corpus parsing or indexing fails | Retain the previous valid index, report the failed items, and do not partially activate invalid content. |

## Evaluation fixtures and metrics

Evaluation fixtures are JSON or TypeScript data files that contain a request, profile, expected relevant chunk IDs, minimum evidence coverage, and required uncertainty behavior. The initial set must include at least these five prompts:

1. “Plan a TypeScript REST endpoint that validates request input and returns consistent errors.”
2. “Propose a test strategy for a service that calls an external payment provider.”
3. “Outline dependency-injection boundaries for a Node.js application with repositories and services.”
4. “Give a deployment-readiness plan for a small TypeScript API, including observability.”
5. “Recommend an authentication approach where the corpus has intentionally incomplete information.”

For each fixture, record:

- retrieval recall at 3 and normalized discounted cumulative gain at 3 against labelled chunks;
- provenance completeness: all supplied passages have complete required metadata;
- citation validity: every response citation exists in the evidence packet;
- grounded-claim support: reviewer or deterministic checker marks each factual claim supported, unsupported, or uncertain;
- safe insufficiency: incomplete-evidence fixture returns an uncertainty or insufficient-evidence result rather than fabricated support.

The initial quality gates should be set only after the corpus and labels are written; raw scores alone are not a release claim. The first gate is 100% provenance completeness and citation validity, plus explicit manual review of all five fixture responses.

## Follow-on implementation sequence

These are proposed follow-on tasks; none is approved by this design.

1. **TASK-002** — Bootstrap strict TypeScript project, shared contracts, and contract tests.
2. **TASK-003** — Implement technology-profile source registration, Markdown ingestion, lifecycle metadata, and audit records.
3. **TASK-004** — Implement deterministic lexical retrieval with active-only filtering and retrieval tests.
4. **TASK-005** — Implement the custom TypeScript Transformer inference boundary and a minimum demonstrable inference path.
5. **TASK-006** — Implement evidence-packet construction, response-schema validation, provenance rendering, and insufficiency behavior.
6. **TASK-007** — Implement the read-only planning agent, evaluation fixtures, metrics, and end-to-end acceptance evidence.

TASK-005 may begin in parallel with TASK-003 and TASK-004 after TASK-002, but integration requires the stable contracts defined here.

## Explicit non-goals for this slice

- Internet crawling, live source fetching, or scheduled updates.
- Vector embeddings, distributed indexing, or a production database.
- Medical knowledge profiles or health guidance.
- Workspace editing, code execution, pull requests, or deployment by the agent.
- Claims of general intelligence, broad domain coverage, or training on internet-scale data.
