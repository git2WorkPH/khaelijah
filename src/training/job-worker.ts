import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { CausalDecoder } from "../model/trainable/decoder.js";
import { AdamW } from "./optimizer.js";
import { batches } from "./dataset.js";
import { captureCheckpoint, checkpointHash, dataIdentity, loadCheckpoint, restoreCheckpoint, saveCheckpoint, canonicalJson } from "./checkpoint.js";
import { train, evaluateLoss } from "./trainer.js";
import { TrainingRegistry, type Run } from "./registry.js";
import { requireDiskSpace } from "../knowledge/disk-budget.js";

async function send(value: unknown): Promise<void> {
  if (!process.connected) throw new Error("Supervisor disconnected.");
  await new Promise<void>((resolve, reject) => process.send!(value, (error: Error | null) => error ? reject(error) : resolve()));
}
const controller = new AbortController();
let finished = false;
process.on("message", (m) => { if ((m as { command?: string }).command === "stop") controller.abort(); });
process.once("disconnect", () => { if (!finished) process.exit(2); });
process.once("SIGTERM", () => controller.abort());

async function work(root: string, id: string) {
  using registry = new TrainingRegistry(root);
  const run: Run = registry.run(id), snapshot = registry.assertEligible(run.snapshot), c = run.config;
  const identity = dataIdentity(snapshot.dataset, c.model.context, c.batchSize);
  const previous = run.resumeCheckpoint ? await loadCheckpoint(run.resumeCheckpoint.path) : null;
  if (previous && (checkpointHash(previous) !== run.resumeCheckpoint!.hash || canonicalJson(previous.config) !== canonicalJson(c.model))) throw new Error("Resume checkpoint identity mismatch.");
  const restored = previous ? restoreCheckpoint(previous, identity) : null;
  const model = restored?.model ?? new CausalDecoder(c.model), optimizer = restored?.optimizer ?? new AdamW(model.parameters());
  if (run.kind === "test") {
    if (!previous) throw new Error("Test requires a selected checkpoint.");
    const testNll = evaluateLoss(model, batches(snapshot.dataset, "test", c.model.context, c.batchSize));
    await send({ type: "checkpoint", ...run.resumeCheckpoint });
    await send({ type: "result", result: { stopReason: "max_steps", testNll, selectedCheckpoint: run.resumeCheckpoint!.hash, taskQuality: "not_scored; human benchmark evaluation belongs to TASK-019", peakWorkerRss: process.resourceUsage().maxRSS * 1024, updates: 0 } }); return;
  }
  const training = batches(snapshot.dataset, "train", c.model.context, c.batchSize), validation = batches(snapshot.dataset, "validation", c.model.context, c.batchSize);
  const initialValidationNll = evaluateLoss(model, validation), started = performance.now();
  const directory = join(root, run.id); await mkdir(directory, { recursive: true });
  const history = previous?.training?.metrics ?? [];
  const result = await train(model, training, optimizer, {
    maxSteps: c.steps, maxMilliseconds: Math.max(1, c.maxMilliseconds - (Date.now() - run.startedAt!)), maxRssBytes: c.maxRssBytes, signal: controller.signal,
    onBoundary: async (state) => {
      if (!state.stopReason && state.step % 5) return;
      requireDiskSpace(root, 128 * 1024 ** 2);
      const checkpointPath = join(directory, `step-${state.step}.json`);
      const checkpoint = captureCheckpoint(model, { optimizer, data: identity, metrics: [...history, ...state.metrics] });
      await saveCheckpoint(checkpointPath, checkpoint);
      await send({ type: "checkpoint", path: checkpointPath, hash: checkpointHash(checkpoint) });
    },
  });
  const finalValidationNll = result.stopReason === "max_steps" && !controller.signal.aborted ? evaluateLoss(model, validation) : null;
  await send({ type: "result", result: { ...result, initialValidationNll, finalValidationNll, cumulativeSteps: optimizer.step, stepsPerSecond: result.completedSteps * 1000 / Math.max(1, performance.now() - started), peakWorkerRss: process.resourceUsage().maxRSS * 1024, parameterCount: model.parameters().reduce((n, p) => n + p.values.length, 0), taskQuality: "not_scored; loss does not establish explanation quality", testEvaluated: false } });
}
// Wait for parent to persist PID/ownership before loading or updating any model.
process.once("message", async (message) => {
  if ((message as { command?: string }).command !== "start") return;
  try { await work(process.argv[2]!, process.argv[3]!); finished = true; process.disconnect?.(); }
  catch (error) { await send({ type: "error", message: (error as Error).message }).catch(() => undefined); process.exitCode = 1; if (process.connected) process.disconnect?.(); }
});
