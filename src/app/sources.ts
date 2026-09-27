import { mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { SqliteKnowledgeStore } from "../knowledge/sqlite-store.js";
import {
  previewSource,
  readSourcePolicies,
} from "../knowledge/source-operations.js";
import { requireDiskSpace } from "../knowledge/disk-budget.js";
import type {
  SourceSubmission,
  SourceReview,
} from "../knowledge/source-policy.js";

const [command, ...args] = process.argv.slice(2);
function jsonFile(path: string) {
  if (statSync(path).size > 65536)
    throw new Error("Expected JSON file <=64 KiB.");
  return JSON.parse(readFileSync(path, "utf8"));
}
function arg(index: number): string {
  const value = args[index];
  if (!value?.trim()) throw new Error("Missing argument.");
  return value;
}
const path = resolve(process.env.JC_KNOWLEDGE_DB ?? "data/knowledge.sqlite"),
  directory = dirname(path);
try {
  mkdirSync(directory, { recursive: true });
  requireDiskSpace(directory, 16_000_000);
  using store = new SqliteKnowledgeStore(path);
  let result: unknown;
  switch (command) {
    case "submit":
      store.submitSource(jsonFile(arg(0)) as SourceSubmission);
      result = { status: "pending" };
      break;
    case "review":
      store.reviewSource(arg(0), jsonFile(arg(1)) as SourceReview);
      result = store.registeredSource(arg(0));
      break;
    case "reactivate":
      store.reviewSource(arg(0), jsonFile(arg(1)) as SourceReview, true);
      result = store.registeredSource(arg(0));
      break;
    case "list":
      result = store.registeredSources();
      break;
    case "preview":
      result = await previewSource(store, arg(0), directory);
      break;
    case "policies":
      result = await readSourcePolicies(store, arg(0));
      break;
    case "refresh": {
      if (arg(0) !== "sqlite-appropriate-uses")
        throw new Error(
          "New sources require preview followed by explicit hash-confirmed commit.",
        );
      const preview = await previewSource(store, arg(0), directory);
      requireDiskSpace(directory, 16_000_000);
      result = store.commitPreview(arg(0), preview.contentHash);
      break;
    }
    case "commit":
      requireDiskSpace(directory, 16_000_000);
      result = store.commitPreview(arg(0), arg(1));
      break;
    case "withdraw":
      store.withdrawSource(arg(0), arg(1), arg(2));
      result = store.registeredSource(arg(0));
      break;
    case "health":
      result = store.health();
      break;
    case "audit":
      result = {
        sourceEvents: store.sourceEvents(),
        refreshes: store.audits(),
      };
      break;
    case "backup":
      await store.backupTo(resolve(arg(0)));
      result = { backup: resolve(arg(0)) };
      break;
    default:
      throw new Error(
        "Usage: pnpm sources submit <source.json> | policies <id> | review/reactivate <id> <review.json> | preview <id> | commit <id> <hash> | withdraw <id> <reviewer> <reason> | list | health | audit | backup <new-path>",
      );
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
