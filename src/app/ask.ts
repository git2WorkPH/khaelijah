import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { SqliteKnowledgeStore } from "../knowledge/sqlite-store.js";
import { SqliteRetriever, sqliteKnowledgeProfile } from "../knowledge/sqlite-retrieval.js";
import { GroundedPlanner } from "../rag/grounded-planner.js";
import { PassagePlanAdapter } from "../rag/passage-plan.js";

const query = process.argv.slice(2).join(" ").trim();
if (!query || query.length > 8192) throw new Error('Usage: pnpm knowledge:ask "question" (1–8192 characters)');
const databasePath = resolve(process.env.JC_KNOWLEDGE_DB ?? "data/knowledge.sqlite");
try {
  using store = new SqliteKnowledgeStore(databasePath, { readOnly: true });
  const profileId = process.env.JC_KNOWLEDGE_PROFILE ?? sqliteKnowledgeProfile.id;
  const profile = { ...sqliteKnowledgeProfile, id: profileId, allowedSourceIds: store.approvedSourceIds(profileId) };
  const planner = new GroundedPlanner(profile, new SqliteRetriever(profile, store), new PassagePlanAdapter());
  const response = await planner.plan(query, randomUUID(), new Date().toISOString());
  console.log(JSON.stringify({ mode: "source-backed-template", modelUsed: false, databasePath, profileId, citationMeaning: "verbatim source quotation", response }, null, 2));
} catch (error) {
  console.error(`Cannot query knowledge: ${error instanceof Error ? error.message : String(error)}. Ingest the approved source first with pnpm knowledge:ingest sqlite-appropriate-uses.`);
  process.exitCode = 1;
}
