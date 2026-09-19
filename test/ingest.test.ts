import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryKnowledgeStore, type KnowledgeProfile } from "../dist/index.js";

const at = "2026-09-19T00:00:00.000Z";
const profile: KnowledgeProfile = {
  id: "technology-typescript-web",
  name: "Technology",
  domain: "technology",
  allowedSourceIds: ["validation-guide:source"],
  retrievalPolicy: { maxResults: 3, minScore: 0.1 },
};

const document = (body: string) => `---
id: validation-guide
title: Validation guide
sourceUrl: https://example.invalid/validation
publisher: JC Model
license: Internal
publishedAt: 2026-09-19
status: active
---
${body}`;

test("ingests traceable chunks and supersedes prior active chunks on update", () => {
  const store = new InMemoryKnowledgeStore();
  assert.equal(store.ingest(profile, { filename: "guide.md", markdown: document("Validate input.") }, at).status, "added");
  assert.equal(store.ingest(profile, { filename: "guide.md", markdown: document("Validate input early.") }, at).status, "updated");
  assert.equal(store.activeChunks().length, 1);
  assert.equal(store.snapshot().chunks.filter((chunk) => chunk.lifecycle === "superseded").length, 1);
});

test("withdrawal excludes document chunks from active retrieval", () => {
  const store = new InMemoryKnowledgeStore();
  store.ingest(profile, { filename: "guide.md", markdown: document("Validate input.") }, at);
  assert.equal(store.withdraw("validation-guide", at).status, "withdrawn");
  assert.equal(store.activeChunks().length, 0);
});

test("failed parsing records an audit without altering the valid index", () => {
  const store = new InMemoryKnowledgeStore();
  store.ingest(profile, { filename: "guide.md", markdown: document("Validate input.") }, at);
  const audit = store.ingest(profile, { filename: "broken.md", markdown: "not markdown front matter" }, at);
  assert.equal(audit.status, "failed");
  assert.equal(store.activeChunks().length, 1);
});
