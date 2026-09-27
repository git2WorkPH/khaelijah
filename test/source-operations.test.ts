import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { SqliteKnowledgeStore } from "../dist/knowledge/sqlite-store.js";
import { previewSource, readSourcePolicies } from "../dist/knowledge/source-operations.js";
import { canonicalSourceUrl, isPublicIPv4, resolvePublicAddress, assertPinnedPeer } from "../dist/knowledge/safe-http.js";
import { requireDiskSpace } from "../dist/knowledge/disk-budget.js";
import { fetchApproved } from "../dist/knowledge/internet-ingest.js";

const source = (id = "html-one") => ({ id, url: `https://example.org/${id}`, title: "Original technology fixture", publisher: "JC test", profileId: "technology-fixtures", license: "Original fixture", licenseUrl: "https://example.org/license", refreshSeconds: 60 });
const review = { reviewer: "fixture-reviewer", reviewedAt: "2026-09-27T00:00:00.000Z", reason: "Original offline fixtures only; not approval of example.org content", retrievalAllowed: true, trainingAllowed: false, robotsUrl: "https://example.org/robots.txt", robotsAllowed: true, termsUrl: "https://example.org/license" };
const html = (text: string) => new Response(text, { headers: { "content-type": "text/html" } });
function setup(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), "jc-sources-")), path = join(dir, "knowledge.sqlite"), store = new SqliteKnowledgeStore(path);
  t.after(() => { store.close(); rmSync(dir, { recursive: true, force: true }); });
  return { dir, path, store };
}
function resetRate(path: string) { const db = new DatabaseSync(path); try { db.exec("UPDATE source_registry SET last_attempt=0"); } finally { db.close(); } }

test("submit review preview commit and reopen CLI across two HTML layouts", async (t) => {
  const { dir, path, store } = setup(t);
  for (const [id, body] of [["html-one", "<main><nav>navigation</nav><p>Database transactions preserve atomic changes.</p></main>"], ["html-two", "<body><header>banner</header><article><h1>Indexes</h1><p>Database indexes accelerate lookups.</p></article></body>"]]) {
    store.submitSource(source(id)); assert.equal(store.registeredSource(id)!.status, "pending");
    let requests = 0;
    await assert.rejects(previewSource(store, id!, dir, { fetch: async () => { requests++; return html(body!); } }), /approval/);
    assert.equal(requests, 0); store.reviewSource(id!, review);
    const preview = await previewSource(store, id!, dir, { fetch: async () => html(body!) });
    assert.doesNotMatch(preview.text, /navigation|banner/);
    assert.equal(store.search("database").filter((p) => p.sourceId === id).length, 0);
    assert.throws(() => store.commitPreview(id!, "wrong"), /Preview/);
    assert.equal(store.commitPreview(id!, preview.contentHash).version, 1);
    assert.equal(store.registeredSource(id)!.review!.trainingAllowed, false);
  }
  using reader = new SqliteKnowledgeStore(path, { readOnly: true });
  assert.equal(reader.approvedSourceIds("technology-fixtures").length, 2);
  assert.equal(reader.search("database", 5, reader.approvedSourceIds("technology-fixtures")).length, 2);
  assert.deepEqual(reader.approvedSourceIds("technology-unrelated"), []);
  const result = spawnSync(process.execPath, [resolve("dist/app/ask.js"), "database"], { encoding: "utf8", env: { ...process.env, JC_KNOWLEDGE_DB: path, JC_KNOWLEDGE_PROFILE: "technology-fixtures" } });
  assert.equal(result.status, 0, result.stderr); const output = JSON.parse(result.stdout);
  assert.equal(output.response.status, "grounded"); assert.equal(output.response.evidence.passages.length, 2);
});

test("withdrawal and rejection cannot be undone by ingest or unchanged refresh", async (t) => {
  const { store, path, dir } = setup(t); store.submitSource(source()); store.reviewSource("html-one", review);
  const fetcher: typeof fetch = async () => html("<main>Database persistence fixture.</main>");
  const p = await previewSource(store, "html-one", dir, { fetch: fetcher });
  const document = store.preview("html-one")!; store.commitPreview("html-one", p.contentHash);
  store.withdrawSource("html-one", "owner", "revoke retrieval"); assert.equal(store.search("database").length, 0);
  assert.throws(() => store.ingest(document), /policy/);
  await assert.rejects(previewSource(store, "html-one", dir, { fetch: fetcher }), /approval/);
  assert.throws(() => store.reviewSource("html-one", review), /reactivation/);
  store.reviewSource("html-one", review, true); assert.equal(store.search("database").length, 0); resetRate(path);
  const second = await previewSource(store, "html-one", dir, { fetch: fetcher });
  assert.equal(store.commitPreview("html-one", second.contentHash).version, 2);
  store.reviewSource("html-one", { ...review, retrievalAllowed: false });
  assert.equal(store.registeredSource("html-one")!.status, "rejected"); assert.equal(store.search("database").length, 0);
  store.reviewSource("html-one", review); resetRate(path);
  assert.equal(store.search("database").length, 0);
  const third = await previewSource(store, "html-one", dir, { fetch: fetcher });
  assert.equal(store.commitPreview("html-one", third.contentHash).version, 3);
  assert.ok(store.sourceEvents().some((e) => e.action === "withdrawn"));
});

test("review changes invalidate previews and in-flight withdrawal cannot publish", async (t) => {
  const { store, path, dir } = setup(t); store.submitSource(source()); store.reviewSource("html-one", review);
  const p = await previewSource(store, "html-one", dir, { fetch: async () => html("<main>Database first</main>") });
  store.reviewSource("html-one", { ...review, trainingAllowed: true });
  assert.throws(() => store.commitPreview("html-one", p.contentHash), /Preview/); resetRate(path);
  await assert.rejects(previewSource(store, "html-one", dir, { fetch: async () => { store.withdrawSource("html-one", "owner", "during fetch"); return html("<main>Database blocked</main>"); } }), /approved/);
  assert.equal(store.search("database").length, 0);
});

test("global lease, refresh rate limit, single retry and failure preservation are bounded", async (t) => {
  const { store, path, dir } = setup(t);
  for (const id of ["html-one", "html-two"]) { store.submitSource(source(id)); store.reviewSource(id, review); }
  const token = store.acquireRefresh("html-one"); assert.throws(() => store.acquireRefresh("html-two"), /UNIQUE/);
  store.releaseRefresh(token); assert.throws(() => store.acquireRefresh("html-one"), /rate/); resetRate(path);
  let calls = 0, waited = 0;
  const p = await previewSource(store, "html-one", dir, { wait: async (ms) => { waited += ms; }, fetch: async () => ++calls === 1 ? new Response("retry", { status: 503 }) : html("<main>Database preserved</main>") });
  assert.equal(calls, 2); assert.equal(waited, 1000); store.commitPreview("html-one", p.contentHash);
  resetRate(path); calls = 0;
  await assert.rejects(previewSource(store, "html-one", dir, { wait: async () => {}, fetch: async () => { calls++; return new Response("no", { status: 503 }); } }), /503/);
  assert.equal(calls, 2); assert.equal(store.search("preserved").length, 1);
  resetRate(path); calls = 0;
  await assert.rejects(previewSource(store, "html-one", dir, { fetch: async () => { calls++; return new Response("no", { status: 429 }); } }), /429/); assert.equal(calls, 1);
});

test("network policy rejects private/reserved DNS peers and unreviewed redirects", async () => {
  for (const ip of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "100.64.0.1", "0.0.0.0", "198.18.0.1", "192.0.2.1", "203.0.113.1", "224.0.0.1", "::1", "::ffff:127.0.0.1"]) assert.equal(isPublicIPv4(ip), false, ip);
  for (const url of ["http://example.org/", "https://user:pass@example.org/", "https://127.1/", "https://2130706433/", "https://0x7f000001/", "https://[::1]/", "https://localhost/", "https://example.org:444/", "https://example.org/#fragment"]) assert.throws(() => canonicalSourceUrl(url), undefined, url);
  await assert.rejects(resolvePublicAddress("example.org", async () => ["93.184.216.34", "127.0.0.1"]), /blocked/);
  const address = await resolvePublicAddress("example.org", async () => ["93.184.216.34"]);
  assert.doesNotThrow(() => assertPinnedPeer(address, "::ffff:93.184.216.34")); assert.throws(() => assertPinnedPeer(address, "127.0.0.1"), /differs/);
  const s = source(); let calls = 0;
  await assert.rejects(fetchApproved({ id: s.id, canonicalUrl: s.url, allowedHost: "example.org", title: s.title, publisher: s.publisher, license: s.license, licenseUrl: s.licenseUrl }, { fetch: async () => { calls++; return new Response(null, { status: 302, headers: { location: "https://example.org/unreviewed" } }); } }), /outside/); assert.equal(calls, 1);
});

test("unsupported pages and insufficient disk never publish data", async (t) => {
  const { store, path, dir } = setup(t); store.submitSource(source()); store.reviewSource("html-one", review);
  let calls = 0;
  await assert.rejects(previewSource(store, "html-one", dir, { diskCheck: () => { throw new Error("disk reserve"); }, fetch: async () => { calls++; return html("<main>x</main>"); } }), /disk/); assert.equal(calls, 0);
  assert.throws(() => requireDiskSpace(dir, 16_000_000, 1024 ** 3, () => 1), /Insufficient/);
  for (const response of [new Response("pdf", { headers: { "content-type": "application/pdf" } }), html('<body><input type="password"></body>'), html('<main><script type="application/ld+json">{"isAccessibleForFree":false}</script>paywall</main>')]) {
    resetRate(path); await assert.rejects(previewSource(store, "html-one", dir, { fetch: async () => response }));
  }
  assert.equal(store.search("database").length, 0);
});

test("schema migration and backup/reopen preserve history index and audit", async (t) => {
  const { store, path, dir } = setup(t); store.submitSource(source()); store.reviewSource("html-one", review);
  for (const text of ["Database old", "Database new"]) {
    resetRate(path); const p = await previewSource(store, "html-one", dir, { fetch: async () => html(`<main>${text}</main>`) }); store.commitPreview("html-one", p.contentHash);
  }
  const copy = join(dir, "backup.sqlite"); await store.backupTo(copy);
  using restored = new SqliteKnowledgeStore(copy);
  assert.equal(restored.search("new")[0]!.version, 2); assert.equal(restored.search("old").length, 0);
  assert.deepEqual(restored.audits(), store.audits()); assert.deepEqual(restored.sourceEvents(), store.sourceEvents());
  assert.equal(restored.health().schemaVersion, 1); assert.equal(restored.health().foreignKeys.length, 0);
  await assert.rejects(store.backupTo(copy), /exist/i);
  const future = join(dir, "future.sqlite"), db = new DatabaseSync(future); db.exec("PRAGMA user_version=99"); db.close(); assert.throws(() => new SqliteKnowledgeStore(future), /version/);
  const legacy = join(dir, "legacy.sqlite"); await store.backupTo(legacy);
  const old = new DatabaseSync(legacy);
  old.exec("DROP TABLE source_registry; DROP TABLE source_events; DROP TABLE source_previews; DROP TABLE knowledge_lease; PRAGMA user_version=0"); old.close();
  using migrated = new SqliteKnowledgeStore(legacy); assert.equal(migrated.health().schemaVersion, 1);
  assert.equal(migrated.search("new")[0]!.version, 2);
  assert.deepEqual(migrated.audits(), store.audits());
  assert.equal(migrated.registeredSource("sqlite-appropriate-uses")!.status, "approved");
  const broken = join(dir, "migration-failure.sqlite"); await store.backupTo(broken);
  const invalid = new DatabaseSync(broken);
  invalid.exec("DROP INDEX registry_url; DROP TABLE source_events; UPDATE source_registry SET submission='not-json'; PRAGMA user_version=0"); invalid.close();
  assert.throws(() => new SqliteKnowledgeStore(broken), /JSON/i);
  const unchanged = new DatabaseSync(broken, { readOnly: true });
  try {
    assert.equal(unchanged.prepare("PRAGMA user_version").get()!.user_version, 0);
    assert.equal(unchanged.prepare("SELECT count(*) AS n FROM documents").get()!.n, 2);
    assert.equal(unchanged.prepare("SELECT count(*) AS n FROM refresh_runs").get()!.n, 2);
  } finally { unchanged.close(); }
});

test("policy preview is bounded and never approves a pending source", async (t) => {
  const { store } = setup(t); store.submitSource(source()); let calls = 0;
  const result = await readSourcePolicies(store, "html-one", async () => { calls++; return new Response("Manual review required", { headers: { "content-type": "text/plain" } }); });
  assert.equal(calls, 2); assert.equal(result.requiresHumanReview, true);
  assert.equal(store.registeredSource("html-one")!.status, "pending");
  assert.equal(result.policies[0]!.sha256.length, 64);
  for (const response of [new Response("x", { status: 302 }), new Response("x", { status: 403 }), new Response("x".repeat(131073), { headers: { "content-type": "text/plain" } })]) {
    await assert.rejects(readSourcePolicies(store, "html-one", async () => response));
  }
  assert.throws(() => store.reviewSource("html-one", { ...review, robotsUrl: "https://other.example/robots.txt" }), /origin/);
});

test("CLI registers and reviews fixture metadata without source-code edits", (t) => {
  const { dir, path } = setup(t), file = join(dir, "source.json"), reviewPath = join(dir, "review.json");
  writeFileSync(file, JSON.stringify(source())); writeFileSync(reviewPath, JSON.stringify(review));
  const run = (...args: string[]) => spawnSync(process.execPath, [resolve("dist/app/sources.js"), ...args], { encoding: "utf8", env: { ...process.env, JC_KNOWLEDGE_DB: path } });
  assert.equal(run("submit", file).status, 0); const approved = run("review", "html-one", reviewPath); assert.equal(approved.status, 0, approved.stderr);
  assert.equal(JSON.parse(approved.stdout).status, "approved"); assert.equal(JSON.parse(approved.stdout).review.trainingAllowed, false);
  assert.equal(run("refresh", "html-one").status, 1); assert.equal(run("health").status, 0);
});
