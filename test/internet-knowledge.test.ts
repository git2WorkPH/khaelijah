import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { approvedInternetSources, chunkText, htmlToText, ingestApprovedSource } from "../dist/knowledge/internet-ingest.js";
import { SqliteKnowledgeStore } from "../dist/knowledge/sqlite-store.js";

function database(): { store: SqliteKnowledgeStore; cleanup(): void } {
  const directory = mkdtempSync(join(tmpdir(), "jc-knowledge-"));
  const store = new SqliteKnowledgeStore(join(directory, "knowledge.sqlite"));
  return { store, cleanup() { store.close(); rmSync(directory, { recursive: true }); } };
}

function response(body: string, init: ResponseInit = {}): Response {
  return new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8", ...init.headers }, ...init });
}

test("approved ingestion persists searchable provenance and unchanged refresh audit", async () => {
  const db = database();
  try {
    const fetcher: typeof fetch = async () => response("<html><body><nav>menu</nav><main><h1>SQLite Uses</h1><p>SQLite works well for local application storage.</p><script>bad()</script></main></body></html>");
    const first = await ingestApprovedSource(db.store, "sqlite-appropriate-uses", { fetch: fetcher, now: () => "2026-09-27T00:00:00.000Z" });
    assert.equal(first.status, "added");
    const results = db.store.search("local application storage");
    assert.equal(results.length, 1);
    assert.equal(results[0]?.sourceId, "sqlite-appropriate-uses");
    assert.equal(results[0]?.license, "Public Domain");
    assert.equal(results[0]?.licenseUrl, "https://www.sqlite.org/copyright.html");
    assert.match(results[0]?.text ?? "", /SQLite works well/);
    assert.doesNotMatch(results[0]?.text ?? "", /menu|bad/);
    const second = await ingestApprovedSource(db.store, "sqlite-appropriate-uses", { fetch: fetcher, now: () => "2026-09-27T01:00:00.000Z" });
    assert.equal(second.status, "unchanged");
    assert.equal(db.store.search("local application storage").length, 1);
    assert.deepEqual(db.store.audits().map((audit) => audit.status), ["added", "unchanged"]);
  } finally { db.cleanup(); }
});

test("changed refresh supersedes prior searchable chunks", async () => {
  const db = database();
  try {
    let body = "<body><main><p>Old unique guidance about embedded databases.</p></main></body>";
    const fetcher: typeof fetch = async () => response(body);
    await ingestApprovedSource(db.store, "sqlite-appropriate-uses", { fetch: fetcher });
    body = "<body><main><p>New unique guidance about application files.</p></main></body>";
    const result = await ingestApprovedSource(db.store, "sqlite-appropriate-uses", { fetch: fetcher });
    assert.equal(result.status, "updated");
    assert.equal(result.version, 2);
    assert.deepEqual(db.store.search("embedded databases"), []);
    assert.equal(db.store.search("application files")[0]?.version, 2);
  } finally { db.cleanup(); }
});

test("failed refresh preserves current searchable version and records failure", async () => {
  const db = database();
  try {
    await ingestApprovedSource(db.store, "sqlite-appropriate-uses", { fetch: async () => response("<body><main><p>Preserved database guidance.</p></main></body>") });
    await assert.rejects(ingestApprovedSource(db.store, "sqlite-appropriate-uses", { fetch: async () => response("no", { status: 503 }) }), /503/);
    assert.equal(db.store.search("preserved guidance").length, 1);
    assert.equal(db.store.audits().at(-1)?.status, "failed");
  } finally { db.cleanup(); }
});

test("only registered source IDs and approved redirect hosts are fetched", async () => {
  const db = database();
  try {
    let calls = 0;
    await assert.rejects(ingestApprovedSource(db.store, "arbitrary", { fetch: async () => { calls++; return response(""); } }), /not approved/);
    assert.equal(calls, 0);
    const redirect: typeof fetch = async () => new Response(null, { status: 302, headers: { location: "https://evil.example/document" } });
    await assert.rejects(ingestApprovedSource(db.store, "sqlite-appropriate-uses", { fetch: redirect }), /outside/);
    assert.equal(db.store.audits().at(-1)?.status, "failed");
  } finally { db.cleanup(); }
});

test("fetch enforces content type and response size", async () => {
  const db = database();
  try {
    await assert.rejects(ingestApprovedSource(db.store, "sqlite-appropriate-uses", { fetch: async () => new Response("plain", { headers: { "content-type": "text/plain" } }) }), /HTML/);
    await assert.rejects(ingestApprovedSource(db.store, "sqlite-appropriate-uses", { fetch: async () => response("<body>too large</body>"), maxBytes: 3 }), /size/);
  } finally { db.cleanup(); }
});

test("HTML extraction, chunk bounds and approved source policy are explicit", () => {
  assert.equal(approvedInternetSources["sqlite-appropriate-uses"]?.license, "Public Domain");
  assert.equal(htmlToText("<html><body><h1>A &amp; B</h1><p>C&nbsp;D</p></body></html>"), "A & B\n\nC D");
  assert.equal(htmlToText("<html><body><nav>menu</nav><div class=fancy><h1>Legacy article</h1><p>No closing body"), "Legacy article\n\nNo closing body");
  const chunks = chunkText(`${"word ".repeat(100)}\n\n${"next ".repeat(100)}`, 300);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 300));
  assert.throws(() => htmlToText("<html></html>"));
  const long = "x".repeat(4000);
  assert.equal(chunkText(long, 300).join(""), long);
  assert.ok(chunkText(long, 300).every((part) => part.length <= 300));
});

test("body streaming remains bounded and timed out after headers arrive", async () => {
  const db = database();
  try {
    const stalled: typeof fetch = async () => new Response(new ReadableStream<Uint8Array>({ start() {} }), { headers: { "content-type": "text/html" } });
    await assert.rejects(ingestApprovedSource(db.store, "sqlite-appropriate-uses", { fetch: stalled, timeoutMs: 20 }), /timed out/);
    assert.equal(db.store.audits().at(-1)?.status, "failed");
    const oversized: typeof fetch = async () => new Response(new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(100)); } }), { headers: { "content-type": "text/html" } });
    await assert.rejects(ingestApprovedSource(db.store, "sqlite-appropriate-uses", { fetch: oversized, maxBytes: 10 }), /size/);
  } finally { db.cleanup(); }
});
