import { DatabaseSync } from "node:sqlite";
import { openSync, readSync, closeSync, realpathSync } from "node:fs";
import { canonicalJson, checkpointHash } from "./checkpoint.js";
import { digest, validateDataset, type Dataset, type TrainingDocument } from "./dataset.js";

export const MAX_SNAPSHOT_BYTES = 1_000_000;
export type Split = TrainingDocument["split"];
export interface Lineage {
  kind: "original" | "knowledge";
  database: string | null;
  sourceId: string;
  documentId: string;
  version: number;
  project: string;
  url: string;
  licenseUrl: string;
  originalHash: string;
  rightsHash: string;
  trainingAllowed: true;
}
export interface Snapshot {
  format: "jc-snapshot-v1";
  domain: "application architecture";
  transform: "trim-lf-v1";
  benchmarkHash: string;
  dataset: Dataset;
  lineage: Record<string, Lineage>;
  exclusions: { documentId: string; reason: string }[];
}
export function readJson(path: string, limit = MAX_SNAPSHOT_BYTES): unknown {
  const file = openSync(path, "r"), bytes = Buffer.alloc(limit + 1); let total = 0;
  try {
    while (total < bytes.length) { const n = readSync(file, bytes, total, bytes.length - total, null); if (!n) break; total += n; }
    if (total > limit) throw new Error("JSON file exceeds size limit.");
    return JSON.parse(bytes.subarray(0, total).toString("utf8"));
  } finally { closeSync(file); }
}
const normalize = (text: string) => text.replace(/\r\n?/g, "\n").trim();
const required = (s: unknown): s is string => typeof s === "string" && s.trim().length > 0;
const hash = (s: unknown) => typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
function shingles(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return new Set(words.length < 5 ? [words.join(" ")] : words.slice(4).map((_, i) => words.slice(i, i + 5).join(" ")));
}
export function nearDuplicate(a: string, b: string): boolean {
  const x = shingles(a), y = shingles(b);
  const common = [...x].filter((s) => y.has(s)).length;
  return common / Math.max(1, Math.min(x.size, y.size)) >= 0.8;
}
export function sensitive(text: string): boolean {
  return /-----BEGIN .*PRIVATE KEY-----|\bAKIA[A-Z0-9]{16}\b|\b(?:password|api[_-]?key|secret)\s*[:=]\s*["']?[^\s"']{8,}|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text);
}
export function validateSnapshot(value: unknown): Snapshot {
  const s = value as Snapshot;
  if (!s || s.format !== "jc-snapshot-v1" || s.domain !== "application architecture" || s.transform !== "trim-lf-v1" || !hash(s.benchmarkHash) || !s.lineage || !Array.isArray(s.exclusions)) throw new Error("Invalid snapshot.");
  if (Buffer.byteLength(canonicalJson(s)) > MAX_SNAPSHOT_BYTES) throw new Error("Snapshot too large.");
  validateDataset(s.dataset);
  if (s.dataset.documents.length > 100) throw new Error("Too many documents.");
  const groups = new Map<string, Split>();
  for (const d of s.dataset.documents) {
    const p = s.lineage[d.id];
    if (!p || !["original", "knowledge"].includes(p.kind) || ![p.sourceId, p.documentId, p.project, p.url, p.licenseUrl].every(required) || !hash(p.originalHash) || !hash(p.rightsHash) || p.trainingAllowed !== true || !Number.isSafeInteger(p.version) || p.version < 1 || (p.kind === "knowledge" && !required(p.database))) throw new Error("Missing rights/provenance.");
    if (d.text !== normalize(d.text) || sensitive(d.text)) throw new Error("Unnormalized or sensitive content; exclude and review.");
    for (const group of [`source:${p.database ?? "original"}:${p.sourceId}`, `project:${p.project}`]) {
      if (groups.has(group) && groups.get(group) !== d.split) throw new Error("Source/project crosses splits.");
      groups.set(group, d.split);
    }
  }
  for (const split of ["train", "validation", "test"]) if (!s.dataset.documents.some((d) => d.split === split)) throw new Error("All three splits required.");
  for (let i = 0; i < s.dataset.documents.length; i++) for (let j = i + 1; j < s.dataset.documents.length; j++) {
    const a = s.dataset.documents[i]!, b = s.dataset.documents[j]!;
    if (a.split !== b.split && nearDuplicate(a.text, b.text)) throw new Error("Cross-split near duplicate.");
  }
  return structuredClone(s);
}
export interface Selection { documentId: number; project: string; split: Split; }
function version(db: DatabaseSync, id: number) {
  const row = db.prepare(`SELECT d.id,d.source_id,d.version,d.text,d.content_hash,d.lifecycle,s.canonical_url,s.license,s.license_url,s.lifecycle source_lifecycle,r.submission,r.review,r.status
    FROM documents d JOIN sources s ON s.id=d.source_id LEFT JOIN source_registry r ON r.id=s.id WHERE d.id=?`).get(id) as Record<string, unknown> | undefined;
  if (!row) throw new Error("Missing version.");
  const review = row.review ? JSON.parse(String(row.review)) : null;
  if (row.status !== "approved" || review?.trainingAllowed !== true || review?.retrievalAllowed !== true || row.source_lifecycle !== "active" || row.lifecycle === "withdrawn" || db.prepare("SELECT id FROM chunks WHERE document_id=? AND lifecycle='withdrawn' LIMIT 1").get(id)) throw new Error("Version lacks current training permission or is withdrawn.");
  if (digest(String(row.text)) !== row.content_hash) throw new Error("Knowledge content hash mismatch.");
  return { row, rightsHash: checkpointHash({ submission: JSON.parse(String(row.submission)), review }) };
}
export function exportKnowledge(path: string, selections: Selection[], benchmarkHash: string): Snapshot {
  if (!Array.isArray(selections) || selections.length < 1 || selections.length > 100) throw new Error("Select 1–100 explicit document versions.");
  const database = realpathSync(path), db = new DatabaseSync(database, { readOnly: true });
  const result: Snapshot = { format: "jc-snapshot-v1", domain: "application architecture", transform: "trim-lf-v1", benchmarkHash, dataset: { version: "architecture-export-v1", documents: [] }, lineage: {}, exclusions: [] };
  try {
    db.exec("BEGIN");
    for (const selection of [...selections].sort((a, b) => a.documentId - b.documentId)) {
      if (!Number.isSafeInteger(selection.documentId) || selection.documentId < 1 || !required(selection.project) || !["train", "validation", "test"].includes(selection.split)) throw new Error("Invalid selection.");
      const id = String(selection.documentId);
      try {
        const { row, rightsHash } = version(db, selection.documentId), text = normalize(String(row.text));
        if (sensitive(text)) throw new Error("Sensitive-content marker; excluded pending review.");
        result.dataset.documents.push({ id, source: String(row.canonical_url), license: String(row.license), split: selection.split, text, sha256: digest(text) });
        result.lineage[id] = { kind: "knowledge", database, sourceId: String(row.source_id), documentId: id, version: Number(row.version), project: selection.project, url: String(row.canonical_url), licenseUrl: String(row.license_url), originalHash: String(row.content_hash), rightsHash, trainingAllowed: true };
      } catch (error) { result.exclusions.push({ documentId: id, reason: (error as Error).message }); }
    }
    return validateSnapshot(result);
  } finally { db.close(); }
}
/** Revalidation is deliberately separate from immutable snapshot hashing. */
export function eligibility(s: Snapshot): string[] {
  const reasons: string[] = [];
  for (const p of Object.values(s.lineage)) {
    if (p.kind !== "knowledge") continue;
    let db: DatabaseSync | undefined;
    try {
      db = new DatabaseSync(p.database!, { readOnly: true });
      const current = version(db, Number(p.documentId));
      if (current.rightsHash !== p.rightsHash || current.row.content_hash !== p.originalHash || current.row.source_id !== p.sourceId || Number(current.row.version) !== p.version) throw new Error("Rights/version identity changed.");
    } catch (error) { reasons.push(`${p.sourceId}/${p.documentId}: ${(error as Error).message}`); }
    finally { db?.close(); }
  }
  return reasons;
}
export function originalSnapshot(pack: unknown, benchmarkHash: string): Snapshot {
  const value = pack as { version: string; authorship: string; documents: { id: string; project: string; split: Split; text: string }[] };
  if (!value || !required(value.version) || value.authorship !== "original-project-authored" || !Array.isArray(value.documents)) throw new Error("Original authorship declaration required.");
  const s: Snapshot = { format: "jc-snapshot-v1", domain: "application architecture", transform: "trim-lf-v1", benchmarkHash, dataset: { version: value.version, documents: [] }, lineage: {}, exclusions: [] };
  for (const d of value.documents) {
    const text = normalize(d.text), url = `urn:jc-model:original:${d.id}`;
    s.dataset.documents.push({ id: d.id, source: url, license: "Original project-authored; approved local project training only", split: d.split, text, sha256: digest(text) });
    s.lineage[d.id] = { kind: "original", database: null, sourceId: d.id, documentId: d.id, version: 1, project: d.project, url, licenseUrl: "urn:jc-model:original-project-training", originalHash: digest(d.text), rightsHash: checkpointHash({ authorship: value.authorship, version: value.version }), trainingAllowed: true };
  }
  return validateSnapshot(s);
}
