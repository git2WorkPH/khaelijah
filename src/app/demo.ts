import { ReadOnlyPlanningAgent } from "../agent/planning-agent.js";
import type { GroundedResponse, KnowledgeProfile } from "../core/contracts.js";
import { InMemoryKnowledgeStore } from "../knowledge/ingest.js";
import { LexicalRetriever } from "../knowledge/retrieval.js";
import { TransformerPlanAdapter } from "../model/transformer.js";
import { GroundedPlanner } from "../rag/grounded-planner.js";
import { readFileSync } from "node:fs";

const at = "2026-09-22T00:00:00.000Z";
const documents = ["validation", "payments", "dependency-injection", "observability", "errors", "timeouts", "idempotency", "configuration", "logging", "unit-tests", "health", "rollback"];

export function createTechnologyDemo(): ReadOnlyPlanningAgent {
  const profile: KnowledgeProfile = { id: "technology-typescript-web", name: "Technology TypeScript Web", domain: "technology", allowedSourceIds: documents.map((id) => `${id}:source`), retrievalPolicy: { maxResults: 3, minScore: 0.1 } };
  const store = new InMemoryKnowledgeStore();
  for (const id of documents) {
    const markdown = readFileSync(new URL(`../../corpus/technology-typescript-web/${id}.md`, import.meta.url), "utf8");
    const audit = store.ingest(profile, { filename: `${id}.md`, markdown }, at);
    if (audit.status === "failed") throw new Error(audit.errors.join("; "));
  }
  return new ReadOnlyPlanningAgent(new GroundedPlanner(profile, new LexicalRetriever(profile, store), new TransformerPlanAdapter()));
}

export async function runLocalDemo(task: string): Promise<GroundedResponse> { return createTechnologyDemo().plan(task, "local-demo", at); }
