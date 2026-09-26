# First trainable model — TASK-008

Status: design baseline; TASK-009–011 implemented and verified. TASK-012 checkpoint/resume, generation and held-out gates remain pending. Current task records supersede historical planning status below.

## Outcome and existing gap

Build a tiny TypeScript language model that learns next-token distributions and improves held-out loss. This is a prerequisite for learned application assistance, not evidence of useful software-engineering competence.

`src/model/transformer.ts` currently computes a pooled encoder vector from fixed formula-derived weights. Its hashed, lowercased word IDs cannot be decoded uniquely, attention sees future tokens, and the response adapter returns templates. Keep this demonstration intact while developing the trainable model in a separate module. Neither its RAG fixture scores nor repeated source text qualify as evidence of language learning.

## Initial architecture

Use a CPU-only decoder implemented in TypeScript with owned parameter arrays and explicit backward operations. No Python or hosted inference dependency. Start with Float64Array arithmetic for numerical debugging; other precision or accelerator backends require a later measured change.

| Setting | Initial value |
| --- | --- |
| Tokenization | UTF-8 bytes 0–255; PAD=256, BOS=257, EOS=258 |
| Vocabulary | 259 |
| Context | 64 tokens |
| Width | 32 |
| Blocks | 2 |
| Attention heads | 4, dimension 8 per head |
| Feed-forward width | 128 |
| Batch size | 4 |
| Dropout | Disabled for the initial deterministic baseline |
| Positions | Learned position embeddings, maximum 64 |
| Output | Separate linear vocabulary projection plus bias |

Byte encoding preserves case and whitespace. Decode normal byte tokens with TextDecoder; exclude special tokens and document replacement behavior for invalid generated UTF-8. Never use the old hashed tokenizer for training or decoding.

Input shape is [batch, time]; hidden states are [batch, time, 32]; output logits are [batch, time, 259]. Add token and position embeddings, then repeat:

1. Pre-layer-normalize with learned scale/bias and epsilon 1e-5.
2. Apply learned Q/K/V projections, split into four heads, and scale dot products by sqrt(8).
3. Mask positions after the query and PAD keys before stable softmax. Valid queries always have at least one key; exclude padded queries from loss.
4. Concatenate heads, project, and add the residual.
5. Pre-layer-normalize, apply width 32→128 linear + ReLU + 128→32 linear, then add the residual.

Apply a final learned layer norm and vocabulary projection. Allocate parameters once; forward passes never recreate weights. Count and report actual parameter elements from the registry. Initialize matrix weights with a documented seeded distribution scaled by fan-in, biases to zero, layer-norm scale to one. Persist PRNG state.

## Module boundaries and contracts

```text
src/model/trainable/
  tokenizer.ts      reversible bytes and special IDs
  parameters.ts     named parameters, gradients, initialization
  operations.ts     forward/backward numerical kernels
  decoder.ts        causal blocks and logits
  generation.ts     greedy and seeded sampling
src/training/
  dataset.ts        manifests, splits, shifted windows
  loss.ts           masked cross-entropy
  optimizer.ts      AdamW and gradient clipping
  trainer.ts        bounded loop and metrics
  checkpoint.ts     validated serialization and atomic save
```

Proposed contracts (signatures, not executable implementation):

```ts
interface Parameter {
  name: string;
  shape: readonly number[];
  values: Float64Array;
  gradients: Float64Array;
}
interface Batch {
  inputs: Int32Array;
  targets: Int32Array;
  targetMask: Uint8Array;
  batchSize: number;
  sequenceLength: number;
}
interface Decoder {
  parameters(): readonly Parameter[];
  forward(batch: Batch): { logits: Float64Array; cache: unknown };
  backward(cache: unknown, dLogits: Float64Array): void;
}
```

Training owns caches and disposes them after backward. Evaluation does not accumulate gradients. The decoder imports no corpus files, retrieval store, or agent tools. Keep the existing InferencePort unchanged; learned-generation integration is a later acceptance gate.

## Data and loss

Require a manifest with document ID, SHA-256 content hash, source, license/access justification, split, and dataset version. Begin with original synthetic pattern fixtures; a separate curated text experiment requires explicit corpus approval. The current RAG corpus is not automatically a training corpus.

Split by source document before tokenization and window creation. Reject identical hashes across splits; record any near-duplicate review. Freeze validation and test manifests before training. Validation selects checkpoints; test is evaluated once after selection and never influences updates.

Create document sequences BOS + bytes + EOS. Shift inputs and targets by one token. Make context windows within documents; never leak across train/validation/test or across unrelated document boundaries. Pad final windows and mask padded targets. Record deterministic document/window order, seed, and batch cursor for resume.

Use mean negative log likelihood over unmasked targets, computed with log-sum-exp stabilization. Reject empty target masks. Backward starts with (softmax(logits) − oneHot(target)) / validTargetCount, zeroed at masked positions. Report NLL in nats and perplexity exp(NLL), with explicit overflow handling.

## Training loop and optimizer

Every step: clear gradients → forward → loss → backward → finite checks → global gradient norm clipping at 1.0 → AdamW update → metrics. Clear old caches to prevent memory growth.

Initial hyperparameters: learning rate 1e-3, beta1=0.9, beta2=0.999, epsilon=1e-8, decoupled weight decay 0.01 on matrix weights only. Exclude biases and normalization parameters from decay. Persist first/second moments and optimizer step for bias correction. Treat these as starting experiment settings, not guaranteed convergence values.

Stop at the first of maxSteps=2000, wall time=15 minutes, or process RSS=1 GiB. Check limits between steps; a bounded context also limits a single attention call. Report the stop reason and last fully committed step. A resource stop is an incomplete experiment, never a passing learning gate. Benchmark this configuration before expanding it.

On non-finite loss/gradient/update, fail without publishing a corrupt checkpoint; keep the last validated checkpoint. Support cancellation between steps and save the last complete state. No network or automatic corpus downloads in the trainer.

## Checkpoints and generation

Versioned local checkpoint stores architecture, tokenizer ID, named parameter shapes/values, optimizer moments/step, initialization and sampler PRNG states, data manifest hashes, batch cursor, metrics, runtime version, and checksum. Reject unknown versions, mismatched shapes/tokenizers, non-finite values, oversized payloads, and dataset mismatch on resume.

Write a sibling temporary file, validate it, then atomically rename on the same filesystem. Never overwrite the last known good checkpoint on a failed write. Evaluation loads weights without requiring optimizer state; resumed training requires the complete state.

Greedy generation is the default acceptance path. An optional temperature/top-k sampler uses persisted seeded randomness. Stop at EOS or maxNewTokens=64; use the last 64 input tokens when context fills, with positions reset for that window. Decode only generated byte tokens, and do not sample PAD or BOS. Generated text is not a GroundedPlan until a later structured-output and citation validation task passes.

## Measurable gates

These are acceptance criteria, not blanket claims of success. TASK-009–011 evidence covers tokenizer, numerics, causality, masks, training signal and tiny overfit; resume, generation and three-seed held-out gates remain TASK-012 work.

| Gate | Required evidence |
| --- | --- |
| Tokenizer | Exact UTF-8 encode/decode round trips for ASCII, whitespace, mixed case, and multibyte input |
| Numerics | Each backward kernel and sampled full-model parameters match central finite differences (epsilon 1e-5), abs error <=1e-6 or relative error <=1e-4; avoid ReLU kinks |
| Causality | Changing suffix tokens leaves all earlier logits unchanged within 1e-10 on Float64 CPU |
| Masks | PAD targets contribute zero loss/gradient; one-token and partial batches remain finite |
| Training signal | Updates change both attention and feed-forward weights; a no-update control does not improve through evaluation side effects |
| Tiny overfit | NLL falls by at least 50% on a fixed original repeating-pattern fixture within 500 steps; record curve, seed, and elapsed time |
| Held-out learning | Across seeds 11, 22, 33, each final selected checkpoint has validation NLL at least 10% below its initialization on frozen held-out patterns; report test separately |
| Leakage | Hash-identical cross-split documents rejected; held-out evaluation leaves parameters and optimizer state unchanged |
| Resume | Ten uninterrupted steps and five + checkpoint + five yield parameters and moments within 1e-10 using the same runtime/config/data |
| Generation | Greedy continuation is reproducible after load, respects context/output bounds, and includes a learned-pattern example distinct from the prompt |
| Failure | Malformed checkpoint, invalid tokens, non-finite gradients, cancellation, and configured resource limits have explicit tested outcomes |

Pattern learning proves numerical learning behavior only. Add realistic domain evaluation before claiming software-design usefulness. Do not tune held-out examples or relax thresholds merely to make a failed run pass; record failure and propose a reviewed experiment change.

## Follow-on tasks — current status

- TASK-009: byte tokenizer, parameter registry, numerical kernels and gradient checks.
- TASK-010: causal decoder, backward composition, masked loss, and causality tests; depends on TASK-009.
- TASK-011: manifest loader, split checks, AdamW, bounded training loop, and tiny-overfit experiment; depends on TASK-010.
- TASK-012: checkpoint/resume, generation, three-seed held-out experiment, and acceptance report; depends on TASK-011.

TASK-009–011 are approved and verified; TASK-012 has an approved record under Tasks/Approved/. RAG replacement, domain training and medical capabilities remain outside this milestone. Internet ingestion was delivered separately in TASK-013 and does not imply training permission or model integration.
