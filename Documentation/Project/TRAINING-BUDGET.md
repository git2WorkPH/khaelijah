# Local training resource policy

Status: owner constraints recorded; TASK-015 ingestion and TASK-016 job safeguards implemented. Owner approved TASK-015–020 and the original application-architecture corpus plus a short 60-second/1 GiB baseline. Further scaling/experiments still require reviewed scope and budgets.

TASK-016 defaults remain 60 seconds and 1 GiB RSS, with a separate supervisor, 500 ms pressure/RSS sampling, 64 MiB swap-growth stop and 1 GiB disk reserve plus estimated artifacts. See [operations and limits](../Training/JOBS.md). Its short baseline used about 253 MiB peak worker RSS; this does not calibrate the proposed 6 GiB upper cap or prove other-application responsiveness. Monitoring is not an OS hard memory reservation; no cloud fallback exists.

## Firm owner constraints

- Use only the owner's MacBook Pro M3 with 18 GB RAM and 512 GB total storage (owner-reported; actual available resources must be checked).
- No paid cloud services or remote training compute. No automatic cloud fallback.
- Maximum two hours (7,200 seconds) per run. Shorter existing limits remain valid; this is a ceiling, not a requested duration.
- Leave sufficient resources for other applications; pause or stop when the laptop is under memory pressure.

## Proposed conservative starting policy

- Start with at most 6 GiB process RSS (6 × 1024^3 bytes). This is a provisional engineering cap, not a guarantee that 12 GB remains free: OS, other processes and accelerator allocations also use memory. Lower the cap when necessary; do not automatically raise it after failures.
- One training/evaluation worker at a time. Begin with short profiling runs, then increase only within measured safe limits. A batch of trials needs a declared total time/storage budget; no automatic unlimited two-hour restart loop.
- Measure macOS system memory pressure and swap growth as well as worker RSS; record monitoring support/limitations. Use cooperative early stopping and a supervising process so a long synchronous training step cannot bypass the wall-clock ceiling.
- Include preparation, training, validation and checkpoint publication within the run budget. Reserve time for graceful checkpointing before the deadline; if an unresponsive worker must be terminated at the ceiling, keep the last validated checkpoint and mark the run incomplete. Do not promise a final checkpoint after forced termination.
- Check actual free disk space and estimated dataset, export, checkpoint, temporary-save and rollback sizes before running. Configure and review a minimum free-space reserve before large artifacts; 512 GB total capacity is not available space. Refuse insufficient-space runs, never delete unrelated files to make room.
- Keep weights local and ignored by Git. Cleanup is limited to identified project-owned temporary artifacts under a reviewed retention policy; preserve active and rollback checkpoints.

## Hardware/backend expectation

The current trainer uses CPU Float64 TypeScript operations; M3 GPU acceleration is not implemented. Benchmark this baseline first. Any local accelerator backend needs a separate reviewed architecture decision, dependency/platform feasibility checks, numerical parity tests and measurement of total/unified-memory use. Keep TypeScript as the product runtime; do not silently substitute Python, a hosted model or remote compute.

## Task ownership and acceptance

| Task | Resource-policy responsibility |
| --- | --- |
| TASK-015 | Bounded ingestion/storage, disk preflight and retention/backup policy |
| TASK-016 | Enforce job wall-clock/memory/concurrency limits, log resource telemetry, cancellation/recovery and disk checks |
| TASK-019 | Short local benchmarks, measured model/context/data selection and go/no-go quality evidence within this ceiling |
| TASK-020 | Reject incomplete/over-budget candidates; protect active/rollback artifacts during promotion |
| TASK-017 | Measure inference context/latency/memory and prevent contention with training |
| TASK-018 | Bound tool/test subprocesses; do not run them alongside training without a reviewed aggregate resource budget |

Tests should inject time/memory/disk pressure and stalled-worker conditions; no two-hour test or full-disk exercise is needed. Real short-run profiling must report peak RSS, system pressure/swap observations, elapsed time, throughput, checkpoint size, free space and laptop responsiveness. Quality failure within the budget is a recorded no-go, not authorization to spend money or remove safeguards.
