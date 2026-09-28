# TASK-016 acceptance — 2026-09-28

## Scope and decision

Owner selected application architecture and explicitly approved freezing the original corpus, the 20 explanation/10 uncertainty benchmark, and a supervised 60-second/1 GiB baseline. ADR-004 records the separate SQLite training registry and external weight files. This delivery establishes dataset/job plumbing, not useful architecture explanations or checkpoint promotion.

## Verification

Implementation d179f28; merge 653e4d6 successfully pushed to origin/master. Unrelated user formatting edits were excluded. Documentation-only closeout follows this merge.

- `pnpm test`: PASS, 84 tests including build (73 prior + 11 training-job tests).
- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS (compiler alias, not a separate style/security linter).
- `git diff --check`: PASS at verification.

New tests cover immutable reviewed snapshots, required provenance/rights, source/project and near-duplicate split rejection, benchmark-project contamination, sensitive markers, selected-version export after refresh, withdrawal/start refusal and affected-run flags. They execute real forked tiny-model workers, reopen the registry, resume to cumulative step four and perform one-time zero-update test evaluation. Cancellation, singleton concurrency, conservative process recovery, unknown schema, low disk, pressure/swap/RSS policies, unavailable monitor, synchronous stalled child termination, empty successful exit and mismatched resume hash all have explicit assertions. Existing numerical/checkpoint tests remain unchanged.

Recovery liveness is injected for deterministic stale-record tests; stalled-worker termination is an actual subprocess test. Tests do not fill the disk, exhaust RAM, run two hours or require network. Supported operator interfaces assume a trusted local owner, not hostile code with direct SQLite/filesystem access.

## Frozen inputs and live baseline

Benchmark SHA-256: `197bef45aabec89de045aba42def0fa2ea19e28d1d293ffa8cef23d172e47127`.
Snapshot SHA-256: `5d2be92603e799d8a42e8f6ba46bcfa3a728154c2c7d92bb2f582c5f461e7fa1`.
Config SHA-256: `295906aaad458a34545e4840f6ed120994ce7389bf9f99a52c2dc370e4a53e36`.

Exact command sequence, with hashes/IDs shown in the evidence:

```sh
pnpm jobs freeze datasets/architecture-benchmark-v1.json datasets/architecture-review-v1.json
pnpm jobs original datasets/architecture-original-v1.json 197bef45aabec89de045aba42def0fa2ea19e28d1d293ffa8cef23d172e47127
pnpm jobs approve 5d2be92603e799d8a42e8f6ba46bcfa3a728154c2c7d92bb2f582c5f461e7fa1 datasets/architecture-review-v1.json
pnpm jobs submit 5d2be92603e799d8a42e8f6ba46bcfa3a728154c2c7d92bb2f582c5f461e7fa1
pnpm jobs start 964616ad-8fb1-4473-b5b4-2014e4d9f3d1
pnpm jobs test 964616ad-8fb1-4473-b5b4-2014e4d9f3d1
pnpm jobs start c3a7dd63-d661-4341-8f32-800935e69291
```

Results in [machine-readable evidence](TASK-016-baseline.json):

| Measurement | Result |
| --- | --- |
| Training | 10 completed updates, seed 11, 44,355 parameters, CPU Float64 |
| Run elapsed | 819 ms, including job preparation/validation/checkpoint handling |
| Worker update throughput | 16.44 updates/s over measured worker training-through-validation interval |
| Initial → final validation NLL | 5.8573883255909935 → 4.625060627977373 |
| One-time loss-test NLL | 4.6412598024329945; zero updates; 314 ms |
| Peak worker RSS | 265,060,352 bytes (about 253 MiB); final evaluation 189,579,264 bytes |
| Checkpoint | 2,595,417 bytes; payload hash abe86c7fa1fa648b8c306784b6c7c271fd10619ebb28dfa13b8ed17fca0648d0 |
| Resources | Normal observed pressure (1), no monitor stop; free disk approximately 139 GB |
| Task-quality rubric | Not scored; explanation and uncertainty gates **not established**; promotion not allowed |

The supervisor observed one worker sample during training; evaluation finished before the 500 ms sampling interval and has no external worker sample. It still records worker process peak RSS and initial system observation. There was substantial pre-existing system swap (about 15 GB), not attributable to this subsecond run. The monitor stops on non-normal pressure or >64 MiB growth rather than claiming all swap is this model's use. No subjective laptop-responsiveness assessment was obtained; safe capacity for larger jobs is not established.

Selection policy was fixed before the experiment: final checkpoint after ten updates; no hyperparameter search. Final test loss was read once after selection, not used for tuning. Future use of this already inspected loss holdout must follow a revised evaluation plan; the 30 architecture-answer cases remain unscored for TASK-019.

## Limits, failure analysis and handoff

The corpus is eight short original hypothetical project examples, not a representative architecture education corpus. The context is only 64 byte tokens. Lower NLL demonstrates learning mechanics, not reasoning, correctness, instruction following or application-building ability. No learned adapter has replaced RAG templates. The absence of human-scored outputs is a visible unmet capability gate, not a hidden pass.

Rights and privacy checks combine explicit review with conservative heuristics; they do not prove legal eligibility or absence of every secret. Knowledge paths are recorded absolutely and checked at export/start/resume/runtime. Withdrawal blocks future use and flags existing runs on audit, but cannot untrain weights. There is no automatic erasure, scheduler or cloud fallback.

Run/resource concurrency is enforced in the fixed per-checkout registry. Do not concurrently run legacy toy commands or alternate checkouts; no system-wide OS resource sandbox is claimed. Monitoring needs macOS telemetry permissions; refusal is expected where unavailable. Checkpoints, DB and WAL files are local ignored data; keep a separate consistent backup. New runs never overwrite parent attempts. Recovery refuses live/reused PIDs and may require operator inspection for an orphan.

Next approved task is TASK-019: capability measurement on the frozen architecture rubric, fresh evaluation policy where required, and reviewed data/context improvements within the laptop ceiling. Do not promote this baseline or call it a useful architecture assistant.
