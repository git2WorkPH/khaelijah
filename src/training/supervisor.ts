import { fork, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { statSync } from "node:fs";
import { TrainingRegistry, type Run } from "./registry.js";
import { checkpointHash, dataIdentity, canonicalJson, loadCheckpoint, MAX_CHECKPOINT_BYTES } from "./checkpoint.js";
import { observeResources, resourceStop, type Observation } from "./resource-monitor.js";
import { requireDiskSpace } from "../knowledge/disk-budget.js";

export interface SupervisorHooks {
  observe?: (pid: number, root: string) => Promise<Observation>;
  workerPath?: string; // Trusted deterministic test fixture only; never exposed by CLI.
  pollMs?: number;
}
export async function startRun(registry: TrainingRegistry, id: string, hooks: SupervisorHooks = {}): Promise<Run> {
  const startedAt = Date.now(), run = registry.claim(id, startedAt), config = run.config;
  const deadline = startedAt + config.maxMilliseconds, grace = Math.min(2000, Math.floor(config.maxMilliseconds / 5));
  const estimatedBytes = (Math.ceil(config.steps / 5) + 3) * MAX_CHECKPOINT_BYTES + 2_000_000;
  let child: ChildProcess | undefined, reason: string | null = null, result: Record<string, unknown> | null = null;
  let checkpointQueue: Promise<void> = Promise.resolve(), monitoring = false, exited = false;
  let initialSwap = 0, peakRss = 0, observations = 0, lastObservation: Observation | null = null;
  let startingStep = 0, publishedStep: number | null = null;
  const observe = hooks.observe ?? observeResources;
  let forceTimer: ReturnType<typeof setTimeout> | undefined;
  const stop = (why: string) => {
    reason ??= why;
    if (child?.connected) child.send({ command: "stop" }, () => undefined);
    if (!forceTimer) forceTimer = setTimeout(() => { if (!exited) child?.kill("SIGKILL"); }, Math.max(1, Math.min(grace, deadline - Date.now())));
  };
  const hard = setTimeout(() => { reason ??= "deadline"; if (!exited) child?.kill("SIGKILL"); }, Math.max(1, deadline - Date.now()));
  const early = setTimeout(() => stop("deadline"), Math.max(1, deadline - Date.now() - grace));
  const interrupted = () => stop("cancelled");
  process.once("SIGINT", interrupted); process.once("SIGTERM", interrupted);
  let interval: ReturnType<typeof setInterval> | undefined;
  try {
    requireDiskSpace(registry.root, estimatedBytes);
    const initial = await observe(process.pid, registry.root); initialSwap = initial.swapBytes; lastObservation = initial;
    const preflight = resourceStop(initial, config.maxRssBytes, initialSwap, estimatedBytes);
    registry.observe(id, { action: "preflight", observation: initial, estimatedBytes, deadline });
    if (preflight) throw new Error(preflight);
    if (reason || Date.now() >= deadline - grace) throw new Error("deadline");
    const snapshot = registry.assertEligible(run.snapshot);
    const identity = dataIdentity(snapshot.dataset, config.model.context, config.batchSize);
    if (run.resumeCheckpoint) {
      const prior = await loadCheckpoint(run.resumeCheckpoint.path);
      if (checkpointHash(prior) !== run.resumeCheckpoint.hash || !prior.training) throw new Error("Resume checkpoint identity mismatch.");
      startingStep = prior.training.step;
    }
    child = fork(hooks.workerPath ?? fileURLToPath(new URL("./job-worker.js", import.meta.url)), [registry.root, run.id], { stdio: ["ignore", "ignore", "ignore", "ipc"], execArgv: [] });
    if (!child.pid) throw new Error("Worker failed to spawn.");
    registry.worker(id, child.pid);
    const completion = new Promise<{ code: number | null; signal: string | null }>((resolveExit) => {
      child!.once("error", (error) => { stop(`worker_error: ${error.message}`); resolveExit({ code: 1, signal: null }); });
      child!.once("exit", (code, signal) => { exited = true; resolveExit({ code, signal }); });
    });
    child.on("message", (message) => {
      const m = message as { type: string; path?: string; hash?: string; message?: string; result?: Record<string, unknown> };
      if (m.type === "checkpoint") {
        checkpointQueue = checkpointQueue.then(async () => {
          const path = resolve(m.path ?? "");
          const expected = run.kind === "test" ? run.resumeCheckpoint?.path : join(registry.root, run.id);
          if (!expected || (run.kind === "test" ? path !== expected : !path.startsWith(expected + "/"))) throw new Error("Unexpected checkpoint path.");
          const checkpoint = await loadCheckpoint(path);
          if (checkpointHash(checkpoint) !== m.hash || canonicalJson(checkpoint.config) !== canonicalJson(config.model) || canonicalJson(checkpoint.training?.data) !== canonicalJson(identity) || checkpoint.runtime !== process.version) throw new Error("Published checkpoint identity mismatch.");
          registry.checkpoint(id, { path, hash: m.hash! });
          publishedStep = checkpoint.training!.step;
        }).catch((error) => { stop(`checkpoint_error: ${(error as Error).message}`); });
      } else if (m.type === "result") result = m.result ?? null;
      else if (m.type === "error") stop(`worker_error: ${m.message}`);
    });
    interval = setInterval(() => {
      if (monitoring || exited) return;
      monitoring = true;
      void (async () => {
        if (registry.run(id).cancelRequested) stop("cancelled");
        registry.assertEligible(run.snapshot);
        const current = await observe(child!.pid!, registry.root);
        if (exited) return;
        lastObservation = current; observations++; peakRss = Math.max(peakRss, current.workerRss);
        registry.observe(id, { action: "resources", observation: current });
        const failure = resourceStop(current, config.maxRssBytes, initialSwap, estimatedBytes);
        if (failure) stop(failure);
      })().catch((error) => { if (!exited) stop(`monitor_or_rights: ${(error as Error).message}`); }).finally(() => { monitoring = false; });
    }, hooks.pollMs ?? 500);
    child.send({ command: "start" });
    const exit = await completion;
    await checkpointQueue;
    const latest = registry.run(id);
    if (latest.cancelRequested) reason ??= "cancelled";
    if (Date.now() >= deadline) reason ??= "deadline";
    const reportedPeak = Number((result as Record<string, unknown> | null)?.peakWorkerRss ?? 0);
    if (reportedPeak >= config.maxRssBytes) reason ??= "memory_limit";
    if (!reason && (exit.code !== 0 || !result || (result as Record<string, unknown>).stopReason !== "max_steps")) reason = String((result as Record<string, unknown> | null)?.stopReason ?? `worker_exit_${exit.code}_${exit.signal}`);
    if (!reason && (run.kind === "train" ? (Number((result as Record<string, unknown> | null)?.completedSteps) !== config.steps || publishedStep !== startingStep + config.steps) : publishedStep !== startingStep)) reason = "incomplete_checkpoint_step";
    if (!reason) registry.assertEligible(run.snapshot);
    const details: Record<string, unknown> = { ...(result ?? {}), elapsedMilliseconds: Date.now() - startedAt, peakObservedWorkerRss: peakRss, observations, lastObservation, estimatedArtifactBytes: estimatedBytes, checkpointBytes: latest.checkpoint ? statSync(latest.checkpoint.path).size : 0, supervisorReason: reason };
    if (run.kind === "test") registry.finishTest(id, { ...details, incomplete: reason !== null });
    return registry.finish(id, reason ? (reason === "cancelled" ? "cancelled" : "failed") : "completed", reason ?? "max_steps", details);
  } catch (error) {
    if (child && !exited) {
      child.kill("SIGKILL");
      await new Promise<void>((done) => child!.once("exit", () => done()));
    }
    return registry.finish(id, "failed", reason ?? (error as Error).message, { elapsedMilliseconds: Date.now() - startedAt, incomplete: true, estimatedArtifactBytes: estimatedBytes });
  } finally {
    clearTimeout(hard); clearTimeout(early); clearTimeout(forceTimer); clearInterval(interval);
    process.removeListener("SIGINT", interrupted); process.removeListener("SIGTERM", interrupted);
  }
}
