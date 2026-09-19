import assert from "node:assert/strict";
import test from "node:test";
import { GroundedPlanner, InMemoryKnowledgeStore, LexicalRetriever, TransformerPlanAdapter, type InferencePort, type KnowledgeProfile } from "../dist/index.js";

const at = "2026-09-19T00:00:00.000Z";
const profile: KnowledgeProfile = { id: "technology-typescript-web", name: "Technology", domain: "technology", allowedSourceIds: ["validation:source"], retrievalPolicy: { maxResults: 3, minScore: 0.1 } };
const markdown = `---
id: validation
title: Validation
sourceUrl: https://example.invalid/validation
publisher: JC Model
license: Internal
status: active
---
Validate request input at the HTTP boundary.`;

function planner(inference: InferencePort = new TransformerPlanAdapter()): GroundedPlanner {
  const store = new InMemoryKnowledgeStore(); store.ingest(profile, { filename: "validation.md", markdown }, at);
  return new GroundedPlanner(profile, new LexicalRetriever(profile, store), inference);
}

test("returns a sourced plan only from active evidence", async () => {
  const response = await planner().plan("Plan HTTP input validation", "r1", at);
  assert.equal(response.status, "grounded");
  if (response.status === "grounded") assert.equal(response.plan.citations[0]?.passageId, response.evidence.passages[0]?.chunk.id);
});

test("returns insufficient evidence instead of a plan", async () => {
  assert.equal((await planner().plan("astronomy telescope", "r2", at)).status, "insufficient_evidence");
});

test("rejects model citations not present in the evidence packet", async () => {
  const malicious: InferencePort = { async generate() { return { taskSummary: "x", citations: [{ passageId: "invented", claim: "x" }], recommendations: [], uncertainties: [] }; } };
  assert.equal((await planner(malicious).plan("Validate input", "r3", at)).status, "invalid_citation");
});
