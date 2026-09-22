import type { KnowledgeProfile, RetrievedPassage, RetrievalPort, RetrievalQuery } from "../core/contracts.js";
import { InMemoryKnowledgeStore } from "./ingest.js";

export interface RetrievalOutcome {
  readonly passages: readonly RetrievedPassage[];
  readonly warnings: readonly string[];
}

function tokens(value: string): string[] {
  const stopWords = new Set(["a", "an", "the", "and", "at", "for", "from", "in", "including", "is", "of", "on", "to", "with"]);
  return (value.toLowerCase().match(/[a-z0-9]+/gu) ?? []).filter((token) => !stopWords.has(token));
}

function bm25Score(queryTerms: readonly string[], text: string, averageLength: number): number {
  const terms = tokens(text);
  if (terms.length === 0) return 0;
  const frequency = new Map<string, number>();
  for (const term of terms) frequency.set(term, (frequency.get(term) ?? 0) + 1);
  const k1 = 1.2;
  const b = 0.75;
  return queryTerms.reduce((score, term) => {
    const count = frequency.get(term) ?? 0;
    if (count === 0) return score;
    return score + (count * (k1 + 1)) / (count + k1 * (1 - b + b * (terms.length / averageLength)));
  }, 0);
}

export class LexicalRetriever implements RetrievalPort {
  constructor(private readonly profile: KnowledgeProfile, private readonly store: InMemoryKnowledgeStore) {}

  async retrieve(query: RetrievalQuery): Promise<readonly RetrievedPassage[]> {
    return this.search(query).passages;
  }

  search(query: RetrievalQuery): RetrievalOutcome {
    if (query.profileId !== this.profile.id) return { passages: [], warnings: ["unknown_profile"] };
    const queryTerms = tokens(query.query);
    if (queryTerms.length === 0) return { passages: [], warnings: ["empty_query"] };

    const snapshot = this.store.snapshot();
    const sourceById = new Map(snapshot.sources.map((source) => [source.id, source]));
    const chunks = this.store.activeChunks().filter(
      (chunk) => chunk.profileId === this.profile.id && sourceById.get(chunk.sourceId)?.lifecycle === "active",
    );
    const averageLength = chunks.length === 0 ? 1 : chunks.reduce((total, chunk) => total + tokens(chunk.text).length, 0) / chunks.length;
    const passages = chunks
      .map((chunk) => ({ chunk, score: bm25Score(queryTerms, chunk.text, averageLength), source: sourceById.get(chunk.sourceId)! }))
      .filter((candidate) => candidate.score >= this.profile.retrievalPolicy.minScore)
      .sort((left, right) => right.score - left.score || left.chunk.id.localeCompare(right.chunk.id))
      .slice(0, Math.min(query.limit, this.profile.retrievalPolicy.maxResults))
      .map((candidate, index) => ({ ...candidate, rank: index + 1, retrievedAt: query.retrievedAt }));

    const warnings: string[] = [];
    if (passages.length === 0) warnings.push("insufficient_evidence");
    else if (passages.length < Math.min(query.limit, this.profile.retrievalPolicy.maxResults)) warnings.push("partial_coverage");
    return { passages, warnings };
  }
}
