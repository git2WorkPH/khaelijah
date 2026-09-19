import assert from "node:assert/strict";
import test from "node:test";

import { isLifecycleStatus, validateGroundedPlan, type EvidencePacket } from "../dist/index.js";

const evidence: EvidencePacket = {
  requestId: "request-1",
  profileId: "technology-typescript-web",
  query: "validate input",
  retrievalWarnings: [],
  createdAt: "2026-09-19T00:00:00.000Z",
  passages: [
    {
      score: 1,
      rank: 1,
      retrievedAt: "2026-09-19T00:00:00.000Z",
      chunk: {
        id: "chunk-1",
        profileId: "technology-typescript-web",
        documentId: "doc-1",
        sourceId: "source-1",
        text: "Validate at the boundary.",
        ordinal: 0,
        contentHash: "hash",
        lifecycle: "active",
        ingestedAt: "2026-09-19T00:00:00.000Z",
      },
      source: {
        id: "source-1",
        title: "Validation guide",
        canonicalUrl: "https://example.invalid/validation",
        publisher: "JC Model",
        licenseOrAccess: "Internal",
        registeredAt: "2026-09-19T00:00:00.000Z",
        refreshPolicy: "manual",
        lifecycle: "active",
      },
    },
  ],
};

test("recognizes only governed lifecycle values", () => {
  assert.equal(isLifecycleStatus("active"), true);
  assert.equal(isLifecycleStatus("deleted"), false);
});

test("accepts a plan whose citations are in the evidence packet", () => {
  const result = validateGroundedPlan(
    {
      taskSummary: "Build an API",
      citations: [{ passageId: "chunk-1", claim: "Validate at the boundary." }],
      recommendations: ["Add a validation layer."],
      uncertainties: [],
    },
    evidence,
  );
  assert.equal(result.ok, true);
});

test("rejects a plan with an unknown citation", () => {
  const result = validateGroundedPlan(
    {
      taskSummary: "Build an API",
      citations: [{ passageId: "invented", claim: "Unsupported." }],
      recommendations: [],
      uncertainties: [],
    },
    evidence,
  );
  assert.deepEqual(result, {
    ok: false,
    error: { code: "unknown_citation", message: "Citation 'invented' is not in the evidence packet." },
  });
});
