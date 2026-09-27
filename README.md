# JC Model

JC Model is a TypeScript-only experiment in building a custom language model, a separately updated knowledge layer, and an application-building assistant.

The central idea is to keep **learned model capabilities** separate from **current information**. Training changes model weights. Updating the knowledge layer changes the evidence available at answer time, without retraining the model.

Three separate paths exist today: a local retrieval/template-planning demonstration, a trainable decoder with checkpoint/resume and bounded text generation, and persistent internet-document retrieval. The decoder has learned a synthetic repeating pattern; it is not yet connected to either retrieval path or useful for general application-building.

## Quick start

Use Node.js 22.16+ (development verified on Node 26) and pnpm. The internet knowledge commands require the built-in `node:sqlite` API. Run commands from the repository root.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm demo "Plan request input validation for a TypeScript API"
pnpm evaluate
pnpm knowledge:ingest sqlite-appropriate-uses
pnpm knowledge:search "when should I use SQLite for local storage"
pnpm knowledge:ask "When should I use SQLite for local application storage?"
```

`demo`, `evaluate`, and `test` build the TypeScript source before running. The demo prints JSON; there is no chat UI or running server. No model download or API key is required.

The knowledge commands use `data/knowledge.sqlite` by default. Set `JC_KNOWLEDGE_DB` to choose another database file.

## Persistent internet knowledge

TASK-015 adds reviewed single-page onboarding to TASK-013's persistent ingestion. SQLite's “Appropriate Uses For SQLite” remains the initial approved source. New eligible technology HTML URLs can be submitted, reviewed, previewed and committed without editing source code. Follow the [source operations guide](Documentation/Knowledge/SOURCE-OPERATIONS.md) for JSON examples, rights review, commands and recovery. Public access alone is not reuse permission.

`pnpm knowledge:ingest sqlite-appropriate-uses` preserves the reviewed-source shortcut. Fetching now uses public-IPv4 DNS/connection pinning, exact-URL scope, TLS validation, bounded retries, 15-second request deadlines and a 2 MB response limit. Compressed responses and IPv6-only sources are unsupported. Refresh is rate-limited (at least 60 seconds) and checks disk space. Text extraction, deterministic chunks and hashing precede transactional publication. Unchanged refreshes audit without duplicating content; changed versions supersede prior passages; failures preserve active content. New sources require `pnpm sources preview ID` followed by `pnpm sources commit ID HASH`.

`pnpm knowledge:search "query"` searches active passages through SQLite FTS5 and returns JSON containing passage text, source URL, publisher, license declaration and evidence URL, fetch time, content hash, document version, and rank.

`pnpm knowledge:ask "question"` opens the existing database read-only and uses the shared grounded planner with the approved `technology-sqlite` profile. It returns `mode: "source-backed-template"` and `modelUsed: false`: citations are verbatim passages, with a fixed recommendation to review them, not learned answers. It does not fetch pages, train/load a model, or execute source instructions. Ingest first if the database does not exist; `JC_KNOWLEDGE_DB` also selects the prompt database.

Selected passages carry stable database-local chunk/document IDs, chunk and document hashes, document version, fetch/ingestion and retrieval times, and license evidence. Unknown publication/registration times are omitted. Both before and after response assembly, the planner checks those exact passages' active state/content/provenance; a concurrent refresh or withdrawal yields `stale_evidence`. Merely changing search rank does not invalidate evidence. Empty/unmatched queries return `insufficient_evidence`; invalid response schemas or citation IDs return `invalid_citation`.

FTS5 scores are raw, lower-is-better scores tagged `sqlite-fts5`; they are not compared to the local demo's lexical thresholds. Profile filtering occurs before limiting results. Prompt query terms are stop-word filtered, bounded and quoted for FTS matching. Keyword matches and citation membership do not prove semantic relevance or factual correctness. Retrieved text remains untrusted evidence.

The SQLite file is ignored by Git and intended as local operational data. Model checkpoints remain separate. Ingested text is not automatically approved as training data. New registrations require recorded source-specific rights and robots review. Use `JC_KNOWLEDGE_PROFILE=technology-your-profile` for custom-source prompts. `pnpm sources` provides submit, policies, review, preview, commit, withdraw, reactivate, list, audit, health and backup commands. No background crawl or training is triggered.

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
4. **Validate and return.** Citation IDs must refer to supplied evidence. Exact lifecycle/content/provenance checks detect changes to selected passages during inference without depending on search rank. The agent records the request ID, status, and selected passage IDs in memory.

This exercises the retrieval-augmented generation (RAG) wiring. The separate decoder supports learned text generation, but this demo still uses templates. The agent cannot edit applications, run shell commands, deploy software, or fetch internet sources.

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

TASK-016 adds [reviewed datasets and supervised training jobs](Documentation/Training/JOBS.md). The first approved domain is **application architecture**. Original project-authored examples are separated into train/validation/test groups, with a separate frozen 30-case answer-quality benchmark. `pnpm jobs` provides freeze, export/preview, approve, submit, start, cancel, resume, status and one-time test operations. Metadata lives in `data/training/registry.sqlite`; weight checkpoints remain separate files.

The short 10-update baseline completed under a 60-second/1 GiB budget, with validation NLL 5.86 → 4.63 and held-out loss 4.64. This is pipeline evidence, **not useful learned explanations**; the answer-quality benchmark remains unscored. See [acceptance evidence](Documentation/Acceptance/TASK-016-domain-dataset-evaluation.md). Website ingestion never triggers training automatically, and retrieved content requires separate training permission.

The separate implementation under `src/model/trainable/` provides the building blocks for learning next-token probabilities:

```text
UTF-8 text → byte tokens → token + position embeddings
    → causal Transformer blocks → vocabulary logits
    → masked next-token loss → backward gradients
    → clipped AdamW optimizer updates → checkpoint files
```

- **Tokenizer:** preserves case, whitespace, and valid Unicode through UTF-8 bytes. The vocabulary contains 256 byte values plus PAD, BOS, and EOS. Invalid generated UTF-8 decodes with replacement characters.
- **Parameters:** named Float64 arrays hold weights and gradients. Seeded initialization is reproducible, and gradients can be accumulated and cleared.
- **Decoder:** the default configuration uses a 64-token context, width 32, two blocks, four attention heads, and feed-forward width 128. Each block contains causal self-attention, residual connections, normalization, and a feed-forward network. Causal masking prevents a position from using future tokens.
- **Loss:** masked cross-entropy compares each position's logits with its next-token target. Padding contributes no loss or gradient.
- **Backward pass:** composes explicit numerical derivatives and accumulates parameter gradients. Training caches belong to one model and can be consumed once. Evaluation leaves weights and gradients unchanged.

A training example shifts tokens by one position: inputs `BOS, A, B` predict targets `A, B, EOS`. The loss measures how well the model predicts those targets; gradients describe how changing weights would affect that loss. AdamW applies those changes after global-norm clipping.

Run `pnpm train:toy` to load the original local `datasets/synthetic-pattern-v1.json` fixture and train the decoder for 200 AdamW steps. It prints configuration, dataset hash, loss curve, and pass/fail results. The repeating text verifies learning mechanics, not real-world competence. Training has step/time/memory limits and cancellation between steps. No database or checkpoint is written: weights exist in memory only. The demo still uses the earlier encoder/template adapter.

### Save, resume, and generate (TASK-012)

The separate `model` CLI uses the same frozen synthetic dataset without changing `train:toy`:

```sh
pnpm model train data/pattern.json 200 11
pnpm model resume data/pattern.json 25
pnpm model generate data/pattern.json "abc "
pnpm model experiment data/task012 Documentation/Acceptance/TASK-012-experiment.json
```

`train` starts a new model (optional steps/seed default to 200/11); `resume` loads full state and performs the specified number of additional steps (default 200). Both write the chosen checkpoint path every 25 cumulative steps and on normal/cancellation/resource stops. SIGINT/SIGTERM cancel between updates and save the last complete state; a resource/cancellation stop exits with code 2. Invalid data or I/O errors exit with code 1 and do not replace the prior valid checkpoint. The requested path is replaced on successful saves; use different paths to keep separate runs.

Checkpoints are versioned JSON with canonical sorted-key SHA-256 checksums, named weights, optimizer moments/options/step, RNG states, dataset/batch hashes and order/cursor, runtime and metrics. Validation occurs before restore. A sibling temporary file is flushed and validated before atomic rename. Limits are 32 MiB per file and 500,000 parameter elements; the default model has 44,355. Resume requires the same Node version and matching manifest/batching identity. Evaluation can load weight-only checkpoints through the library without optimizer state. Checksums detect corruption, not authenticity of untrusted files.

`generate` returns only the continuation, defaults to greedy decoding, stops at EOS or 64 new tokens, and slides the context window. The library additionally supports seeded temperature/top-k sampling; it never emits PAD/BOS. Output is ungrounded experimental text, not an accepted implementation plan. Generated invalid UTF-8 bytes decode as replacement characters.

`experiment` runs seeds 11/22/33 for 200 updates each, measures validation every 25, selects the lowest validation-loss checkpoint, then evaluates test once per selected model. All three passed the required 10% validation improvement and reproduced `abc abc abc ` after reload. These held-out patterns are intentionally near-duplicates, not realistic generalization evidence. See [acceptance results](Documentation/Acceptance/TASK-012-checkpoints-generation.md).

Checkpoints under `data/` are ignored by Git and need separate backups. No training-run database exists; SQLite stores knowledge documents, not model weights.

## Verification

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm evaluate
```

The current suite contains 64 tests, including persistent prompt provenance, read-only database/CLI behavior, profile isolation, refresh/withdrawal and ranking changes during inference, untrusted-source handling, checkpoint corruption/failure handling, exact multi-batch resume, bounded generation, read-only evaluation, dataset validation, optimizer numerics, bounded training, tokenizer round trips, kernel/full-model gradients, causal masking, batch isolation, padding, ingestion, retrieval, and response validation. Gradient checks compare backward results with numerical perturbations.

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
| `src/model/trainable/` | Byte tokenizer, parameters, numerical kernels, causal decoder, and generation |
| `src/training/` | Dataset manifests, masked loss, AdamW, bounded training, and checkpoint persistence |
| `src/evaluation/` | Synthetic request fixtures and evaluation metrics |
| `corpus/` | Local Markdown demonstration knowledge |
| `test/` | Automated verification |
| `Documentation/` | Project scope, architecture, approved tasks, and session memory |

## Next milestones

TASK-011 and TASK-012 implement dataset manifests, AdamW, bounded training, checkpoints/resume, generation, and synthetic held-out evaluation. TASK-014 connects SQLite knowledge to source-backed template prompts. TASK-015 proposes knowledge operations and requires approval. See [task register](Documentation/Tasks/README.md) and [technical handover](Documentation/SessionMemory/TECHNICAL-HANDOVER.md) for continuation.

Continuous internet refresh, useful learned application planning, semantic conflict detection, and application-editing tools remain future work. The long-term direction keeps current domain knowledge in the governed knowledge layer rather than attempting to train on the entire internet.
