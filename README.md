# JC Model

JC Model is a TypeScript-only experiment in building a custom language model, a separately updated knowledge layer, and an application-building assistant.

The central idea is to keep **learned model capabilities** separate from **current information**. Training changes model weights. Updating the knowledge layer changes the evidence available at answer time, without retraining the model.

Two parts exist today: a runnable local retrieval/planning demonstration, and a separate trainable decoder with tested forward/backward calculations. The decoder has not yet been trained or connected to the demonstration.

## Quick start

Use Node.js 22.16+ (development verified on Node 26) and pnpm. The internet knowledge commands require the built-in `node:sqlite` API. Run commands from the repository root.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm demo "Plan request input validation for a TypeScript API"
pnpm evaluate
pnpm knowledge:ingest sqlite-appropriate-uses
pnpm knowledge:search "when should I use SQLite for local storage"
```

`demo`, `evaluate`, and `test` build the TypeScript source before running. The demo prints JSON; there is no chat UI or running server. No model download or API key is required.

The knowledge commands use `data/knowledge.sqlite` by default. Set `JC_KNOWLEDGE_DB` to choose another database file.

## Persistent internet knowledge

TASK-013 adds a deliberately narrow internet-ingestion path. The only initial source is SQLite's “Appropriate Uses For SQLite” documentation. The source registry records its canonical URL, publisher, public-domain status, and the SQLite copyright page that supports that status. Arbitrary URLs are rejected.

`pnpm knowledge:ingest sqlite-appropriate-uses` performs a manual HTTPS fetch with a timeout, redirect-host allowlist, HTML content-type check, and 2 MB response limit. It extracts readable text, creates deterministic passages, hashes the normalized document, and commits the refresh to SQLite in one transaction. Repeating an unchanged refresh records an audit without duplicating content. Changed content creates a new active version and supersedes prior passages. Failed fetches or parsing keep the last active version searchable.

`pnpm knowledge:search "query"` searches active passages through SQLite FTS5 and returns JSON containing passage text, source URL, publisher, public-domain declaration and evidence URL, fetch time, content hash, document version, and rank. This is the first prompt-like use of internet knowledge: the prompt searches stored evidence. It is not yet passed to the custom decoder or the read-only planning demo.

The SQLite file is ignored by Git and intended as local operational data. Model checkpoints remain separate. Ingested text is not automatically approved as training data. Adding another source requires a code-reviewed allowlist entry and evidence that its terms permit the intended storage and retrieval use.

## How the current demo works

```text
Application-planning request
    → Read-only planning agent
    → Lexical search over active local passages
    → Evidence packet: passages, source metadata, warnings
    → Fixed-weight encoder + template response adapter
    → Citation and evidence-freshness checks
    → JSON response and in-memory request log
```

1. **Load the knowledge profile.** Each invocation reads 12 explicitly listed Markdown documents from `corpus/technology-typescript-web/` into an in-memory store. Front matter identifies the source, publisher, license/access context, and publication date. Paragraphs become chunks with identifiers and ingestion metadata.
2. **Retrieve evidence.** The request is matched against active chunks using deterministic lexical scoring. The demo returns up to three passages above its score threshold. This is word-based retrieval; embeddings and a vector database are not implemented.
3. **Construct the response.** The planner passes the request and evidence to `TransformerPlanAdapter`. That adapter runs the fixed-weight encoder, copies retrieved passages into citations, and supplies a fixed review recommendation. The numerical encoder output does not generate the recommendation text.
4. **Validate and return.** Citation IDs must refer to supplied evidence. A second retrieval detects changes to selected passage IDs during inference. The agent records the request ID, status, and selected passage IDs in memory.

This exercises the retrieval-augmented generation (RAG) wiring. Learned text generation is still pending. The agent cannot edit applications, run shell commands, deploy software, or fetch internet sources.

### Reading the output

| Field/status | Meaning |
| --- | --- |
| `grounded` | The response passed the current structure and citation-ID checks; this is not a guarantee of factual correctness. |
| `plan.taskSummary` | The submitted request. |
| `plan.citations` | Passage IDs and quoted fixture content. |
| `plan.recommendations` | The current template recommendation. |
| `plan.uncertainties` | Prototype limitations and retrieval warnings. |
| `evidence` | Retrieved content, scores, ranks, source information, and timestamps. |
| `insufficient_evidence` | No passage met the retrieval threshold. |
| `stale_evidence` | Selected evidence became inactive or changed during inference. |
| `invalid_citation` | Model output failed response validation, including unknown citation IDs. |

For example, an unsupported request can exercise the insufficient-evidence path:

```sh
pnpm demo "Recommend an authentication approach for an undocumented protocol"
```

### Where the knowledge comes from

The corpus is synthetic, internally authored evaluation material. Its `example.invalid` URLs are fixture identifiers, not independently verified internet sources. It has no automatic refresh schedule. The store exposes update and withdrawal operations, but the CLI rebuilds it from the local files on every run; logs and indexed state are not persisted.

To change a demonstration passage, edit its Markdown file and rerun the demo. Adding a document also requires adding its ID to the explicit list in `src/app/demo.ts`; the directory is not automatically scanned. Modifying this corpus does not train either model.

## How the trainable model works

The separate implementation under `src/model/trainable/` provides the building blocks for learning next-token probabilities:

```text
UTF-8 text → byte tokens → token + position embeddings
    → causal Transformer blocks → vocabulary logits
    → masked next-token loss → backward gradients
    → optimizer updates [not implemented yet]
```

- **Tokenizer:** preserves case, whitespace, and valid Unicode through UTF-8 bytes. The vocabulary contains 256 byte values plus PAD, BOS, and EOS. Invalid generated UTF-8 decodes with replacement characters.
- **Parameters:** named Float64 arrays hold weights and gradients. Seeded initialization is reproducible, and gradients can be accumulated and cleared.
- **Decoder:** the default configuration uses a 64-token context, width 32, two blocks, four attention heads, and feed-forward width 128. Each block contains causal self-attention, residual connections, normalization, and a feed-forward network. Causal masking prevents a position from using future tokens.
- **Loss:** masked cross-entropy compares each position's logits with its next-token target. Padding contributes no loss or gradient.
- **Backward pass:** composes explicit numerical derivatives and accumulates parameter gradients. Training caches belong to one model and can be consumed once. Evaluation leaves weights and gradients unchanged.

A training example will shift tokens by one position: inputs `BOS, A, B` predict targets `A, B, EOS`. The loss measures how well the model predicts those targets; gradients describe how changing weights would affect that loss. An optimizer must still apply those changes.

Run `pnpm train:toy` to load the original local `datasets/synthetic-pattern-v1.json` fixture and train the decoder for 200 AdamW steps. It prints configuration, dataset hash, loss curve, and pass/fail results. The repeating text verifies learning mechanics, not real-world competence. Training has step/time/memory limits and cancellation between steps. No database or checkpoint is written: weights exist in memory only. The demo still uses the earlier encoder/template adapter.

## Verification

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm evaluate
```

The current suite contains 44 tests, including dataset validation, optimizer numerics, bounded training, tokenizer round trips, kernel/full-model gradients, causal masking, batch isolation, padding, ingestion, retrieval, and response validation. Gradient checks compare backward results with numerical perturbations.

`pnpm evaluate` prints five synthetic request fixtures, their responses, retrieval recall@3/nDCG@3, provenance checks, citation-ID checks, and insufficient-evidence behavior. Citation identity does not establish semantic support. Passing these checks does not demonstrate general application-building ability. The `lint` script currently repeats TypeScript checking rather than running a separate style linter.

## Repository map

| Path | Purpose |
| --- | --- |
| `src/app/` | CLI and local demonstration assembly |
| `src/agent/` | Read-only request orchestration and logs |
| `src/knowledge/` | Markdown ingestion, lifecycle records, and lexical retrieval |
| `src/knowledge/sqlite-store.ts` | Persistent versions, audits, FTS5 passages, and provenance |
| `src/knowledge/internet-ingest.ts` | Approved-source network policy, fetch, HTML extraction, and chunking |
| `src/rag/` | Evidence assembly and response validation |
| `src/model/transformer.ts` | Existing fixed-weight encoder and template adapter |
| `src/model/trainable/` | Byte tokenizer, parameters, numerical kernels, and causal decoder |
| `src/training/` | Masked next-token loss; training loop pending |
| `src/evaluation/` | Synthetic request fixtures and evaluation metrics |
| `corpus/` | Local Markdown demonstration knowledge |
| `test/` | Automated verification |
| `Documentation/` | Project scope, architecture, approved tasks, and session memory |

## Next milestones

TASK-011 implements dataset manifests, split isolation, AdamW, bounded training, and a successful tiny-overfit experiment. TASK-012 is next: checkpoint/resume, generation, and held-out evaluation. See `Documentation/Architecture/TRAINABLE-MODEL.md` for the acceptance gates.

Continuous internet refresh, useful learned application planning, semantic conflict detection, and application-editing tools remain future work. The long-term direction keeps current domain knowledge in the governed knowledge layer rather than attempting to train on the entire internet.
