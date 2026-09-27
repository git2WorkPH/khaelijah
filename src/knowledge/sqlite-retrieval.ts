import { createHash } from "node:crypto";
import type { KnowledgeProfile, RetrievedPassage, RetrievalPort, RetrievalOutcome, RetrievalQuery } from "../core/contracts.js";
import { SqliteKnowledgeStore, type KnowledgeSearchResult } from "./sqlite-store.js";

const stopWords = new Set(["a", "an", "the", "and", "at", "for", "from", "in", "is", "of", "on", "to", "with", "how", "what", "when", "where", "why", "should", "could", "would", "can", "do", "does", "me", "my", "please", "tell", "about"]);
export const sqliteKnowledgeProfile: KnowledgeProfile = Object.freeze({
  id: "technology-sqlite", name: "Approved SQLite documentation", domain: "technology",
  allowedSourceIds: Object.freeze(["sqlite-appropriate-uses"]),
  retrievalPolicy: Object.freeze({ maxResults: 5, minScore: 0 }),
});

export class SqliteRetriever implements RetrievalPort {
  constructor(private readonly profile: KnowledgeProfile, private readonly store: SqliteKnowledgeStore) {
    if (profile.retrievalPolicy.minScore !== 0) throw new Error("SQLite FTS5 uses match eligibility, not a local lexical score threshold; minScore must be 0.");
    if (!Number.isInteger(profile.retrievalPolicy.maxResults) || profile.retrievalPolicy.maxResults < 1 || profile.retrievalPolicy.maxResults > 50) throw new Error("Invalid SQLite result bound.");
  }

  private passage(row: KnowledgeSearchResult, at: string): RetrievedPassage {
    return {
      chunk: {
        id: `sqlite:chunk:${row.chunkId}`, documentId: `sqlite:document:${row.documentId}`, profileId: this.profile.id,
        sourceId: row.sourceId, text: row.text, ordinal: row.ordinal,
        contentHash: createHash("sha256").update(row.text).digest("hex"), documentContentHash: row.contentHash,
        documentVersion: row.version, fetchedAt: row.fetchedAt, ingestedAt: row.fetchedAt, lifecycle: "active",
      },
      source: {
        id: row.sourceId, title: row.title, canonicalUrl: row.canonicalUrl, publisher: row.publisher,
        licenseOrAccess: row.license, licenseEvidenceUrl: row.licenseUrl, refreshPolicy: "manual", lifecycle: "active",
      },
      score: row.score, scoreKind: "sqlite-fts5", rank: row.rank, retrievedAt: at,
    };
  }

  async retrieve(query: RetrievalQuery): Promise<RetrievalOutcome> {
    if (query.profileId !== this.profile.id) return { passages: [], warnings: ["unknown_profile"] };
    if (!Number.isInteger(query.limit) || query.limit < 1 || query.query.length > 8192) return { passages: [], warnings: ["invalid_query"] };
    const terms = [...new Set(query.query.toLowerCase().match(/[a-z0-9]+/gu)?.filter((t) => t.length > 1 && !stopWords.has(t)) ?? [])];
    if (!terms.length) return { passages: [], warnings: ["empty_query"] };
    const limit = Math.min(query.limit, this.profile.retrievalPolicy.maxResults);
    const passages = this.store.search(terms.join(" "), limit, this.profile.allowedSourceIds).map((row) => this.passage(row, query.retrievedAt));
    return { passages, warnings: passages.length === 0 ? ["insufficient_evidence"] : passages.length < limit ? ["partial_coverage"] : [] };
  }

  async isCurrent(passages: readonly RetrievedPassage[]): Promise<boolean> {
    return passages.every((p) => {
      const match = /^sqlite:chunk:([1-9][0-9]*)$/.exec(p.chunk.id);
      if (!match || p.chunk.profileId !== this.profile.id || !this.profile.allowedSourceIds.includes(p.source.id)) return false;
      const row = this.store.activeChunk(Number(match[1]));
      if (!row) return false;
      const current = this.passage(row, p.retrievedAt);
      return JSON.stringify(current.chunk) === JSON.stringify(p.chunk) && JSON.stringify(current.source) === JSON.stringify(p.source);
    });
  }
}
