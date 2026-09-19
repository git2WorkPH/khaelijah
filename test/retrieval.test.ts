import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryKnowledgeStore, LexicalRetriever, type KnowledgeProfile } from "../dist/index.js";

const at = "2026-09-19T00:00:00.000Z";
const profile: KnowledgeProfile = {
  id: "technology-typescript-web", name: "Technology", domain: "technology",
  allowedSourceIds: ["validation:source", "testing:source"], retrievalPolicy: { maxResults: 3, minScore: 0.1 },
};
const doc = (id: string, body: string) => `---
id: ${id}
title: ${id}
sourceUrl: https://example.invalid/${id}
publisher: JC Model
license: Internal
status: active
---
${body}`;

test("ranks active matching chunks with complete provenance", () => {
  const store = new InMemoryKnowledgeStore();
  store.ingest(profile, { filename: "validation.md", markdown: doc("validation", "Validate request input at the HTTP boundary.") }, at);
  store.ingest(profile, { filename: "testing.md", markdown: doc("testing", "Use integration tests for payment-provider contracts.") }, at);
  const outcome = new LexicalRetriever(profile, store).search({ profileId: profile.id, query: "validate HTTP input", limit: 3, retrievedAt: at });
  assert.equal(outcome.passages[0]?.chunk.documentId, "validation");
  assert.equal(outcome.passages[0]?.source.canonicalUrl, "https://example.invalid/validation");
  assert.equal(outcome.passages[0]?.rank, 1);
  assert.deepEqual(outcome.warnings, ["partial_coverage"]);
});

test("excludes withdrawn chunks and reports insufficient evidence", () => {
  const store = new InMemoryKnowledgeStore();
  store.ingest(profile, { filename: "validation.md", markdown: doc("validation", "Validate request input.") }, at);
  store.withdraw("validation", at);
  const outcome = new LexicalRetriever(profile, store).search({ profileId: profile.id, query: "validate", limit: 1, retrievedAt: at });
  assert.deepEqual(outcome.passages, []);
  assert.deepEqual(outcome.warnings, ["insufficient_evidence"]);
});
