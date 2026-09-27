import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { checkpointHash, canonicalJson } from "./checkpoint.js";
import { eligibility, nearDuplicate, validateSnapshot, type Snapshot } from "./snapshot.js";
import { validateJob, type JobConfig } from "./job-policy.js";
import { requireDiskSpace } from "../knowledge/disk-budget.js";

export interface Review { reviewer: string; reason: string; reviewedAt: string; rights: true; privacy: true; contamination: true; }
export interface Run {
  id: string; kind: "train" | "test"; snapshot: string; config: JobConfig; configHash: string; runtime: string;
  parent: string | null; resumeCheckpoint: { path: string; hash: string } | null;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  createdAt: number; startedAt: number | null; endedAt: number | null;
  supervisorPid: number | null; workerPid: number | null; cancelRequested: boolean;
  reason: string | null; checkpoint: { path: string; hash: string } | null;
  result: Record<string, unknown> | null; needsReview: string[];
}
export function validateReview(r: Review): void {
  if (!r || ![r.reviewer, r.reason, r.reviewedAt].every((x) => typeof x === "string" && x.trim() && x.length <= 4000) || !Number.isFinite(Date.parse(r.reviewedAt)) || r.rights !== true || r.privacy !== true || r.contamination !== true) throw new Error("Explicit rights/privacy/contamination review required.");
}
export const alive = (pid: number | null): boolean => {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return (e as NodeJS.ErrnoException).code !== "ESRCH"; }
};
export class TrainingRegistry implements Disposable {
  readonly root: string;
  private db: DatabaseSync;
  constructor(directory: string) {
    this.root = resolve(directory); mkdirSync(this.root, { recursive: true });
    requireDiskSpace(this.root, 16_000_000);
    this.db = new DatabaseSync(join(this.root, "registry.sqlite"), { timeout: 1000 });
    const version = Number(this.db.prepare("PRAGMA user_version").get()!.user_version);
    if (version > 1) { this.db.close(); throw new Error("Unknown training registry version."); }
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS snapshots(hash TEXT PRIMARY KEY,payload TEXT NOT NULL,review TEXT);
      CREATE TRIGGER IF NOT EXISTS immutable_snapshot BEFORE UPDATE OF hash,payload ON snapshots BEGIN SELECT RAISE(ABORT,'Immutable snapshot'); END;
      CREATE TABLE IF NOT EXISTS benchmarks(hash TEXT PRIMARY KEY,payload TEXT NOT NULL,review TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,status TEXT NOT NULL,record TEXT NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS single_worker ON runs(status) WHERE status='running';
      CREATE TABLE IF NOT EXISTS run_events(id INTEGER PRIMARY KEY,run_id TEXT NOT NULL,at INTEGER NOT NULL,detail TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS final_tests(snapshot TEXT PRIMARY KEY,test_key TEXT NOT NULL UNIQUE,run_id TEXT NOT NULL,status TEXT NOT NULL,result TEXT);
      PRAGMA user_version=1;`);
  }
  [Symbol.dispose](): void { this.db.close(); }
  private tx<T>(fn: () => T): T { this.db.exec("BEGIN IMMEDIATE"); try { const x = fn(); this.db.exec("COMMIT"); return x; } catch (e) { this.db.exec("ROLLBACK"); throw e; } }
  freezeBenchmark(value: unknown, review: Review): string {
    validateReview(review);
    const b = value as { domain: string; split: string; cases: { id: string; project: string; kind: string; question: string; evidence: string; expected: string }[]; rubric: unknown };
    if (b?.domain !== "application architecture" || b.split !== "sealed-test" || !b.rubric || !Array.isArray(b.cases) || b.cases.length > 100 || b.cases.filter((c) => c.kind === "explanation").length < 20 || b.cases.filter((c) => ["insufficient", "conflicting"].includes(c.kind)).length < 10 || new Set(b.cases.map((c) => c.id)).size !== b.cases.length || b.cases.some((c) => ![c.id, c.project, c.question, c.evidence, c.expected].every((s) => typeof s === "string" && s.trim()))) throw new Error("Invalid frozen benchmark.");
    const payload = canonicalJson(value);
    if (payload.length > 100000) throw new Error("Benchmark too large.");
    const hash = checkpointHash(value);
    this.db.prepare("INSERT OR IGNORE INTO benchmarks VALUES(?,?,?)").run(hash, payload, canonicalJson(review)); return hash;
  }
  benchmark(hash: string): unknown {
    const row = this.db.prepare("SELECT payload FROM benchmarks WHERE hash=?").get(hash);
    if (!row) throw new Error("Benchmark must be frozen and reviewed first.");
    const b = JSON.parse(String(row.payload)); if (checkpointHash(b) !== hash) throw new Error("Benchmark hash mismatch."); return b;
  }
  preview(value: unknown): string {
    const s = validateSnapshot(value); this.benchmark(s.benchmarkHash);
    const b = this.benchmark(s.benchmarkHash) as { cases: { project: string; question: string; expected: string }[] };
    for (const p of Object.values(s.lineage)) if (b.cases.some((c) => c.project === p.project)) throw new Error("Benchmark project contaminates dataset.");
    for (const d of s.dataset.documents) if (b.cases.some((c) => nearDuplicate(d.text, `${c.question} ${c.expected}`))) throw new Error("Benchmark text contaminates dataset.");
    const hash = checkpointHash(s);
    this.db.prepare("INSERT OR IGNORE INTO snapshots(hash,payload) VALUES(?,?)").run(hash, canonicalJson(s)); return hash;
  }
  snapshot(hash: string): { value: Snapshot; review: Review | null } {
    const row = this.db.prepare("SELECT * FROM snapshots WHERE hash=?").get(hash);
    if (!row) throw new Error("Unknown snapshot.");
    const value = validateSnapshot(JSON.parse(String(row.payload)));
    if (checkpointHash(value) !== hash) throw new Error("Snapshot hash mismatch.");
    return { value, review: row.review ? JSON.parse(String(row.review)) as Review : null };
  }
  approve(hash: string, review: Review): void {
    validateReview(review); const s = this.snapshot(hash);
    if (s.review && canonicalJson(s.review) !== canonicalJson(review)) throw new Error("Snapshot approval is immutable; create a newly reviewed snapshot revision.");
    const problems = eligibility(s.value); if (problems.length) throw new Error(problems.join("; "));
    this.db.prepare("UPDATE snapshots SET review=? WHERE hash=? AND review IS NULL").run(canonicalJson(review), hash);
  }
  assertEligible(hash: string): Snapshot {
    const s = this.snapshot(hash); if (!s.review) throw new Error("Snapshot needs explicit review."); validateReview(s.review);
    const problems = eligibility(s.value); if (problems.length) throw new Error(problems.join("; "));
    return s.value;
  }
  submit(snapshot: string, config: JobConfig, parent: Run | null = null, kind: "train" | "test" = "train"): Run {
    this.assertEligible(snapshot); validateJob(config);
    if (parent && (parent.status === "running" || parent.status === "queued" || !parent.checkpoint || parent.snapshot !== snapshot || canonicalJson(parent.config.model) !== canonicalJson(config.model) || parent.config.batchSize !== config.batchSize)) throw new Error("Resume requires a stopped compatible checkpoint.");
    if (parent?.kind === "test" || (kind === "test" && parent?.status !== "completed")) throw new Error("Final test needs a selected completed training candidate.");
    const run: Run = { id: randomUUID(), kind, snapshot, config, configHash: checkpointHash(config), runtime: process.version, parent: parent?.id ?? null, resumeCheckpoint: parent?.checkpoint ?? null, status: "queued", createdAt: Date.now(), startedAt: null, endedAt: null, supervisorPid: null, workerPid: null, cancelRequested: false, reason: null, checkpoint: null, result: null, needsReview: [] };
    this.tx(() => {
      if (kind === "test") {
        const s = this.snapshot(snapshot).value;
        const testKey = checkpointHash({ benchmark: s.benchmarkHash, documents: s.dataset.documents.filter((d) => d.split === "test") });
        this.db.prepare("INSERT INTO final_tests(snapshot,test_key,run_id,status) VALUES(?,?,?,'reserved')").run(snapshot, testKey, run.id);
      }
      this.db.prepare("INSERT INTO runs VALUES(?,?,?)").run(run.id, run.status, canonicalJson(run)); this.event(run.id, { action: "submitted", parent: run.parent }); }); return run;
  }
  run(id: string): Run { const row = this.db.prepare("SELECT record FROM runs WHERE id=?").get(id); if (!row) throw new Error("Unknown run."); return JSON.parse(String(row.record)) as Run; }
  list(): Run[] { return this.db.prepare("SELECT record FROM runs ORDER BY rowid").all().map((r) => JSON.parse(String(r.record)) as Run); }
  private save(r: Run): void { this.db.prepare("UPDATE runs SET status=?,record=? WHERE id=?").run(r.status, canonicalJson(r), r.id); }
  private event(id: string, detail: unknown): void { this.db.prepare("INSERT INTO run_events(run_id,at,detail) VALUES(?,?,?)").run(id, Date.now(), canonicalJson(detail)); }
  events(id: string) { return this.db.prepare("SELECT at,detail FROM run_events WHERE run_id=? ORDER BY id").all(); }
  claim(id: string, startedAt: number): Run {
    return this.tx(() => { const r = this.run(id); if (r.status !== "queued") throw new Error("Only queued runs can start."); this.assertEligible(r.snapshot);
      if (r.runtime !== process.version || checkpointHash(r.config) !== r.configHash) throw new Error("Run runtime/config mismatch.");
      r.status = "running"; r.startedAt = startedAt; r.supervisorPid = process.pid; this.save(r); this.event(id, { action: "started" }); return r; });
  }
  worker(id: string, pid: number): void { this.tx(() => { const r = this.run(id); if (r.status !== "running" || r.supervisorPid !== process.pid) throw new Error("Lost worker ownership."); r.workerPid = pid; this.save(r); }); }
  checkpoint(id: string, checkpoint: NonNullable<Run["checkpoint"]>): void { this.tx(() => { const r = this.run(id); if (r.status !== "running") throw new Error("Run no longer running."); r.checkpoint = checkpoint; this.save(r); this.event(id, { action: "checkpoint", ...checkpoint }); }); }
  observe(id: string, detail: unknown): void { this.event(id, detail); }
  cancel(id: string): void { this.tx(() => { const r = this.run(id); if (!["queued", "running"].includes(r.status)) throw new Error("Run is already stopped."); r.cancelRequested = true; if (r.status === "queued") { r.status = "cancelled"; r.reason = "cancelled_before_start"; r.endedAt = Date.now(); } this.save(r); this.event(id, { action: "cancel_requested" }); }); }
  finish(id: string, status: "completed" | "failed" | "cancelled", reason: string, result: Record<string, unknown> | null): Run {
    return this.tx(() => { const r = this.run(id); if (r.status !== "running") throw new Error("Run no longer running.");
      if (status === "completed" && (!r.checkpoint || r.cancelRequested || reason !== "max_steps")) throw new Error("Cannot falsely complete run.");
      r.status = status; r.reason = reason; r.result = result; r.endedAt = Date.now(); this.save(r); this.event(id, { action: status, reason }); return r; });
  }
  recover(isAlive = alive): string[] {
    return this.tx(() => { const recovered = []; for (const r of this.list().filter((r) => r.status === "running")) {
      if (isAlive(r.supervisorPid) || isAlive(r.workerPid)) throw new Error("A recorded process is still alive; refusing recovery/overlap.");
      r.status = "failed"; r.reason = "interrupted_process"; r.endedAt = Date.now(); this.save(r); this.event(r.id, { action: "recovered_incomplete" }); recovered.push(r.id);
    } return recovered; });
  }
  auditRights(): Run[] { return this.tx(() => { for (const r of this.list()) { r.needsReview = eligibility(this.snapshot(r.snapshot).value); this.save(r); } return this.list(); }); }
  finishTest(id: string, result: unknown): void { this.db.prepare("UPDATE final_tests SET status='recorded',result=? WHERE run_id=? AND status='reserved'").run(canonicalJson(result), id); }
  testStatus() { return this.db.prepare("SELECT * FROM final_tests").all(); }
}
