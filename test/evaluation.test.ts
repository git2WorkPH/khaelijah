import assert from "node:assert/strict";
import test from "node:test";
import { createTechnologyDemo, evaluateResponse, technologyFixtures } from "../dist/index.js";

test("the read-only agent executes all required fixtures with grounded metrics", async () => {
  const agent = createTechnologyDemo();
  const results = await Promise.all(technologyFixtures.map(async (fixture) => evaluateResponse(fixture, await agent.plan(fixture.prompt, fixture.id, "2026-09-19T00:00:00.000Z"))));
  assert.equal(results.length, 5);
  assert.equal(results.every((result) => result.provenanceComplete && result.citationValid && result.safeInsufficiency), true);
  assert.equal(results.filter((result) => result.fixtureId !== "incomplete-auth").every((result) => result.recallAt3 === 1 && result.ndcgAt3 > 0), true);
  assert.equal(agent.logs.length, 5);
});
