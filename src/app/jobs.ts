import { resolve } from "node:path";
import { TrainingRegistry, type Review } from "../training/registry.js";
import { readJson, originalSnapshot, exportKnowledge, type Selection } from "../training/snapshot.js";
import { DEFAULT_JOB, validateJob } from "../training/job-policy.js";
import { startRun } from "../training/supervisor.js";

const [command, ...args] = process.argv.slice(2);
const arg = (i: number) => { if (!args[i]?.trim()) throw new Error("Missing argument."); return args[i]!; };
try {
  // One supported registry per checkout; do not run legacy toy training concurrently.
  using registry = new TrainingRegistry(resolve("data/training"));
  let result: unknown;
  switch (command) {
    case "freeze": result = { benchmarkHash: registry.freezeBenchmark(readJson(arg(0)), readJson(arg(1)) as Review) }; break;
    case "original": result = { snapshotHash: registry.preview(originalSnapshot(readJson(arg(0)), arg(1))) }; break;
    case "export": result = { snapshotHash: registry.preview(exportKnowledge(resolve(arg(0)), readJson(arg(1)) as Selection[], arg(2))) }; break;
    case "snapshot": result = registry.snapshot(arg(0)); break;
    case "approve": registry.approve(arg(0), readJson(arg(1)) as Review); result = registry.snapshot(arg(0)); break;
    case "submit": result = registry.submit(arg(0), args[1] ? validateJob(readJson(args[1])) : DEFAULT_JOB); break;
    case "start": result = await startRun(registry, arg(0)); if (result && (result as { status: string }).status !== "completed") process.exitCode = 2; break;
    case "cancel": registry.cancel(arg(0)); result = registry.run(arg(0)); break;
    case "resume": { const parent = registry.run(arg(0)); result = registry.submit(parent.snapshot, args[1] ? validateJob(readJson(args[1])) : parent.config, parent); break; }
    case "test": { const selected = registry.run(arg(0)); result = registry.submit(selected.snapshot, selected.config, selected, "test"); break; }
    case "status": result = args[0] ? { run: registry.run(args[0]), events: registry.events(args[0]) } : { runs: registry.list(), finalTests: registry.testStatus() }; break;
    case "recover": result = { recovered: registry.recover() }; break;
    case "audit": result = registry.auditRights(); break;
    default: throw new Error("Usage: pnpm jobs freeze <benchmark.json> <review.json> | original <pack.json> <benchmarkHash> | export <knowledge.sqlite> <selections.json> <benchmarkHash> | snapshot <hash> | approve <hash> <review.json> | submit <hash> [config.json] | start/cancel/resume/test/status <runId> | recover | audit");
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error((error as Error).message); process.exitCode = 1; }
