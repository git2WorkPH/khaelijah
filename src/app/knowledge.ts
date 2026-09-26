import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ingestApprovedSource } from "../knowledge/internet-ingest.js";
import { SqliteKnowledgeStore } from "../knowledge/sqlite-store.js";

const [command, ...args] = process.argv.slice(2);
const databasePath = resolve(process.env.JC_KNOWLEDGE_DB ?? "data/knowledge.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });
using store = new SqliteKnowledgeStore(databasePath);
if (command === "ingest") {
  const sourceId = args[0];
  if (!sourceId) throw new Error("Usage: pnpm knowledge:ingest sqlite-appropriate-uses");
  console.log(JSON.stringify({ sourceId, databasePath, result: await ingestApprovedSource(store, sourceId) }, null, 2));
} else if (command === "search") {
  const query = args.join(" ").trim();
  if (!query) throw new Error('Usage: pnpm knowledge:search "when should I use SQLite"');
  console.log(JSON.stringify({ query, databasePath, results: store.search(query) }, null, 2));
} else {
  throw new Error('Usage: pnpm knowledge:ingest sqlite-appropriate-uses | pnpm knowledge:search "query"');
}
