import assert from "node:assert/strict";
import test from "node:test";
import { TinyTransformer, TransformerPlanAdapter, VocabularyTokenizer } from "../dist/index.js";

test("tokenization and Transformer forward passes are deterministic", () => {
  const tokens = new VocabularyTokenizer().encode("validate input validate");
  const model = new TinyTransformer({ vocabularySize: 8192, dimensions: 4 });
  assert.deepEqual(model.forward(tokens), model.forward(tokens));
  assert.equal(model.forward(tokens).length, 4);
});

test("adapter returns a bounded plan-shaped draft", async () => {
  const output = await new TransformerPlanAdapter().generate({ task: "Plan validation", outputSchema: "grounded-implementation-plan-v1", evidence: { requestId: "r", profileId: "p", query: "validation", passages: [], retrievalWarnings: ["partial_coverage"], createdAt: "2026-09-19T00:00:00.000Z" } });
  assert.equal(typeof output, "object");
  assert.deepEqual((output as { recommendations: string[] }).recommendations.length, 1);
});
