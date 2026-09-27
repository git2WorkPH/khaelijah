import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { TrainingRegistry } from "../dist/training/registry.js";
import { originalSnapshot, validateSnapshot, exportKnowledge, eligibility, nearDuplicate, sensitive } from "../dist/training/snapshot.js";
import { checkpointHash, loadCheckpoint } from "../dist/training/checkpoint.js";
import { DEFAULT_JOB, validateJob } from "../dist/training/job-policy.js";
import { startRun } from "../dist/training/supervisor.js";
import { resourceStop } from "../dist/training/resource-monitor.js";
import { SqliteKnowledgeStore } from "../dist/knowledge/sqlite-store.js";
import { digest } from "../dist/training/dataset.js";

const benchmark = JSON.parse(readFileSync("datasets/architecture-benchmark-v1.json", "utf8"));
const pack = JSON.parse(readFileSync("datasets/architecture-original-v1.json", "utf8"));
const review = { reviewer: "offline-test-reviewer", reason: "Original test fixtures only", reviewedAt: "2026-09-28T00:00:00Z", rights: true as const, privacy: true as const, contamination: true as const };
const healthy = { workerRss: 10_000_000, pressure: 1, swapBytes: 0, freeDiskBytes: 100 * 1024 ** 3, support: "injected test observations" };
const config = { ...DEFAULT_JOB, steps: 2, maxMilliseconds: 5000, model: { context: 8, width: 4, blocks: 1, heads: 1, feedForward: 8, seed: 11 } };
function setup(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), "jc-jobs-")), registry = new TrainingRegistry(root);
  t.after(() => { registry[Symbol.dispose](); rmSync(root, { recursive: true, force: true }); });
  const benchmarkHash = registry.freezeBenchmark(benchmark, review), snapshot = originalSnapshot(pack, benchmarkHash), hash = registry.preview(snapshot);
  return { root, registry, hash, snapshot, benchmarkHash };
}

test("snapshots freeze rights lineage splits and reject contamination/sensitive material", (t) => {
  const { registry, snapshot, hash } = setup(t);
  assert.equal(registry.preview(snapshot), hash);
  assert.throws(() => registry.submit(hash, config), /review/);
  registry.approve(hash, review); assert.equal(registry.submit(hash, config).status, "queued");
  const missing = structuredClone(snapshot); delete (missing.lineage[missing.dataset.documents[0]!.id] as any).trainingAllowed;
  assert.throws(() => validateSnapshot(missing), /rights/);
  const leaking = structuredClone(snapshot), a = leaking.dataset.documents[0]!, b = leaking.dataset.documents.find((d) => d.split === "validation")!;
  leaking.lineage[b.id]!.project = leaking.lineage[a.id]!.project;
  assert.throws(() => validateSnapshot(leaking), /crosses/);
  const duplicate = structuredClone(snapshot), v = duplicate.dataset.documents.find((d) => d.split === "validation")!;
  v.text = duplicate.dataset.documents[0]!.text + " Additional sentence."; v.sha256 = digest(v.text);
  assert.throws(() => validateSnapshot(duplicate), /near duplicate/);
  assert.equal(nearDuplicate("one two three four five six", "one two three four five six seven"), true);
  assert.equal(sensitive("Contact person@company.example"), true);
  const contaminated = structuredClone(snapshot); contaminated.lineage[a.id]!.project = benchmark.cases[0].project;
  assert.throws(() => registry.preview(contaminated), /contaminates/);
});

test("knowledge export preserves selected version hash after refresh and rejects revoked rights", (t) => {
  const { root, registry, benchmarkHash } = setup(t), path = join(root, "knowledge.sqlite");
  using knowledge = new SqliteKnowledgeStore(path);
  const texts = ["Ports isolate rules from database adapters and permit focused business tests.", "Gradual rollout needs compatible schema evolution and measured adoption.", "Queue processing exposes asynchronous completion with recoverable work state."];
  for (let i = 0; i < 3; i++) {
    const id = `fixture-${i}`, url = `https://example.org/${id}`;
    knowledge.submitSource({ id, url, title: id, publisher: "Original test", profileId: "technology-architecture", license: "Original fixture", licenseUrl: "https://example.org/license", refreshSeconds: 60 });
    knowledge.reviewSource(id, { reviewer: "test", reason: "Original offline test", reviewedAt: review.reviewedAt, retrievalAllowed: true, trainingAllowed: true, robotsAllowed: true, robotsUrl: "https://example.org/robots.txt", termsUrl: "https://example.org/license" });
    knowledge.ingest({ sourceId: id, canonicalUrl: url, title: id, publisher: "Original test", license: "Original fixture", licenseUrl: "https://example.org/license", fetchedAt: review.reviewedAt, text: texts[i]!, chunks: [texts[i]!], contentHash: digest(texts[i]!) });
  }
  const selections = [{ documentId: 1, project: "one", split: "train" as const }, { documentId: 2, project: "two", split: "validation" as const }, { documentId: 3, project: "three", split: "test" as const }];
  const before = exportKnowledge(path, selections, benchmarkHash);
  knowledge.ingest({ sourceId: "fixture-0", canonicalUrl: "https://example.org/fixture-0", title: "fixture-0", publisher: "Original test", license: "Original fixture", licenseUrl: "https://example.org/license", fetchedAt: review.reviewedAt, text: "Changed content", chunks: ["Changed content"], contentHash: digest("Changed content") });
  assert.equal(checkpointHash(exportKnowledge(path, selections, benchmarkHash)), checkpointHash(before));
  assert.deepEqual(eligibility(before), []);
  const snapshotHash = registry.preview(before); registry.approve(snapshotHash, review);
  const run = registry.submit(snapshotHash, config);
  knowledge.withdrawSource("fixture-0", "test", "revoke");
  assert.equal(eligibility(before).length, 1);
  assert.throws(() => exportKnowledge(path, selections, benchmarkHash), /splits/);
  assert.equal(registry.auditRights().find((r) => r.id === run.id)!.needsReview.length, 1);
  assert.throws(() => registry.claim(run.id, Date.now()), /withdrawn/);
});

test("recorded worker run checkpoint resume and sealed test persist without training on test", async (t) => {
  const { root, registry, hash } = setup(t); registry.approve(hash, review);
  const run = registry.submit(hash, config);
  const done = await startRun(registry, run.id, { observe: async () => healthy, pollMs: 20 });
  assert.equal(done.status, "completed", JSON.stringify(done)); assert.ok(done.checkpoint);
  const checkpoint = await loadCheckpoint(done.checkpoint!.path);
  assert.equal(checkpoint.training!.step, 2); assert.equal(done.result!.testEvaluated, false);
  using reopened = new TrainingRegistry(root);
  assert.equal(reopened.run(run.id).checkpoint!.hash, checkpointHash(checkpoint));
  const resumed = reopened.submit(hash, config, reopened.run(run.id));
  const resumedDone = await startRun(reopened, resumed.id, { observe: async () => healthy, pollMs: 20 });
  assert.equal(resumedDone.status, "completed", JSON.stringify(resumedDone));
  assert.equal((await loadCheckpoint(resumedDone.checkpoint!.path)).training!.step, 4);
  assert.notEqual(resumedDone.checkpoint!.path, done.checkpoint!.path);
  const finalTest = registry.submit(hash, config, resumedDone, "test");
  assert.throws(() => registry.submit(hash, config, done, "test"), /UNIQUE/);
  const tested = await startRun(registry, finalTest.id, { observe: async () => healthy, pollMs: 20 });
  assert.equal(tested.status, "completed", JSON.stringify(tested)); assert.equal(tested.result!.updates, 0);
  assert.ok(Number.isFinite(tested.result!.testNll)); assert.equal(registry.testStatus()[0]!.status, "recorded");
});

test("queued cancellation, concurrency and explicit dead-process recovery never imply completion", (t) => {
  const { root, registry, hash } = setup(t); registry.approve(hash, review);
  const cancelled = registry.submit(hash, config); registry.cancel(cancelled.id);
  assert.equal(registry.run(cancelled.id).status, "cancelled"); assert.throws(() => registry.claim(cancelled.id, Date.now()), /queued/);
  const first = registry.submit(hash, config), second = registry.submit(hash, config);
  registry.claim(first.id, Date.now());
  using other = new TrainingRegistry(root);
  assert.throws(() => other.claim(second.id, Date.now()), /UNIQUE/);
  assert.throws(() => registry.recover(() => true), /alive/);
  assert.deepEqual(registry.recover(() => false), [first.id]);
  assert.equal(registry.run(first.id).reason, "interrupted_process"); assert.equal(registry.run(first.id).status, "failed");
});

test("policy ceilings and resource observations fail closed", () => {
  assert.throws(() => validateJob({ ...config, maxMilliseconds: 7200001 }), /policy/);
  assert.throws(() => validateJob({ ...config, maxRssBytes: 7 * 1024 ** 3 }), /policy/);
  assert.equal(resourceStop({ ...healthy, workerRss: 2 * 1024 ** 3 }, 1024 ** 3, 0, 1), "memory_limit");
  assert.equal(resourceStop({ ...healthy, pressure: 2 }, 1024 ** 3, 0, 1), "memory_pressure");
  assert.equal(resourceStop({ ...healthy, swapBytes: 100 * 1024 ** 2 }, 1024 ** 3, 0, 1), "memory_pressure");
  assert.equal(resourceStop({ ...healthy, freeDiskBytes: 1 }, 1024 ** 3, 0, 1), "disk_reserve");
});

test("preflight low disk pressure and unavailable monitor retain auditable failed runs", async (t) => {
  const { registry, hash } = setup(t); registry.approve(hash, review);
  for (const observation of [{ ...healthy, freeDiskBytes: 1 }, { ...healthy, pressure: 4 }]) {
    const run = registry.submit(hash, config), stopped = await startRun(registry, run.id, { observe: async () => observation });
    assert.equal(stopped.status, "failed"); assert.equal(stopped.workerPid, null); assert.equal(stopped.checkpoint, null);
  }
  const run = registry.submit(hash, config), stopped = await startRun(registry, run.id, { observe: async () => { throw new Error("monitor unavailable"); } });
  assert.equal(stopped.status, "failed"); assert.match(stopped.reason!, /unavailable/);
});

test("supervisor terminates a synchronous unresponsive worker at its deadline", async (t) => {
  const { registry, hash } = setup(t); registry.approve(hash, review);
  const run = registry.submit(hash, { ...config, maxMilliseconds: 400 });
  const started = Date.now();
  const stopped = await startRun(registry, run.id, { observe: async () => healthy, workerPath: resolve("test/fixtures/stalled-training-worker.mjs"), pollMs: 20 });
  assert.equal(stopped.status, "failed"); assert.equal(stopped.reason, "deadline"); assert.equal(stopped.checkpoint, null);
  assert.ok(Date.now() - started < 3000); assert.throws(() => process.kill(stopped.workerPid!, 0));
});

test("running cancellation stops worker and creates no false completed record", async (t) => {
  const { registry, hash } = setup(t); registry.approve(hash, review);
  const run = registry.submit(hash, { ...config, steps: 2000 }); let samples = 0;
  const stopped = await startRun(registry, run.id, { observe: async () => { if (++samples === 3) registry.cancel(run.id); return healthy; }, pollMs: 20 });
  assert.equal(stopped.status, "cancelled", JSON.stringify(stopped));
});

test("worker exit without publication and in-flight pressure cannot complete a job", async (t) => {
  const { registry, hash } = setup(t); registry.approve(hash, review);
  const empty = registry.submit(hash, config);
  const failed = await startRun(registry, empty.id, { observe: async () => healthy, workerPath: resolve("test/fixtures/empty-training-worker.mjs") });
  assert.equal(failed.status, "failed"); assert.equal(failed.checkpoint, null);
  const pressured = registry.submit(hash, config); let samples = 0;
  const stopped = await startRun(registry, pressured.id, { observe: async () => ++samples > 1 ? { ...healthy, pressure: 2 } : healthy, workerPath: resolve("test/fixtures/stalled-training-worker.mjs"), pollMs: 20 });
  assert.equal(stopped.status, "failed"); assert.equal(stopped.reason, "memory_pressure");
});

test("changed resume checkpoint identity fails and preserves the parent artifact", async (t) => {
  const { registry, hash } = setup(t); registry.approve(hash, review);
  const run = registry.submit(hash, config);
  const done = await startRun(registry, run.id, { observe: async () => healthy });
  assert.equal(done.status, "completed");
  const resumed = registry.submit(hash, config, { ...done, checkpoint: { ...done.checkpoint!, hash: "0".repeat(64) } });
  const failed = await startRun(registry, resumed.id, { observe: async () => healthy });
  assert.equal(failed.status, "failed"); assert.match(failed.reason!, /identity mismatch/);
  assert.equal(checkpointHash(await loadCheckpoint(done.checkpoint!.path)), done.checkpoint!.hash);
});

test("immutable snapshot storage and unknown future schema fail explicitly", (t) => {
  const { root } = setup(t), db = new DatabaseSync(join(root, "registry.sqlite"));
  try {
    assert.throws(() => db.exec("UPDATE snapshots SET payload='{}'"), /Immutable/);
    db.exec("PRAGMA user_version=99"); assert.throws(() => new TrainingRegistry(root), /version/);
  } finally { db.close(); }
});
