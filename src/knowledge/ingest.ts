import type {
  DocumentId,
  IsoInstant,
  KnowledgeChunk,
  KnowledgeProfile,
  LifecycleStatus,
  SourceId,
  SourceRecord,
} from "../core/contracts.js";

export interface CorpusDocumentInput {
  readonly filename: string;
  readonly markdown: string;
}

export interface IngestionAudit {
  readonly documentId: DocumentId;
  readonly sourceId?: SourceId;
  readonly status: "added" | "updated" | "withdrawn" | "failed";
  readonly chunkCount: number;
  readonly contentHash?: string;
  readonly at: IsoInstant;
  readonly errors: readonly string[];
}

export interface IngestionSnapshot {
  readonly sources: readonly SourceRecord[];
  readonly chunks: readonly KnowledgeChunk[];
  readonly audits: readonly IngestionAudit[];
}

interface ParsedDocument {
  readonly documentId: DocumentId;
  readonly source: SourceRecord;
  readonly text: string;
}

const requiredFields = ["id", "title", "sourceUrl", "publisher", "license", "status"] as const;

function hash(text: string): string {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(16).padStart(8, "0");
}

function splitFrontMatter(markdown: string): { attributes: Record<string, string>; body: string } {
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/u.exec(markdown.trim());
  if (!match) throw new Error("Document must contain YAML-style front matter.");

  const attributes: Record<string, string> = {};
  for (const line of match[1]!.split("\n")) {
    const separator = line.indexOf(":");
    if (separator < 1) throw new Error(`Invalid front-matter line '${line}'.`);
    attributes[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  for (const field of requiredFields) {
    if (!attributes[field]) throw new Error(`Missing required front-matter field '${field}'.`);
  }
  return { attributes, body: match[2]!.trim() };
}

function parseDocument(input: CorpusDocumentInput, registeredAt: IsoInstant): ParsedDocument {
  const { attributes, body } = splitFrontMatter(input.markdown);
  if (attributes.status !== "active") throw new Error("Only active source documents may be ingested.");
  if (!body) throw new Error("Document body must not be empty.");

  const documentId = attributes.id!;
  const sourceId = `${documentId}:source`;
  return {
    documentId,
    text: body,
    source: {
      id: sourceId,
      title: attributes.title!,
      canonicalUrl: attributes.sourceUrl!,
      publisher: attributes.publisher!,
      licenseOrAccess: attributes.license!,
      ...(attributes.publishedAt ? { publishedAt: attributes.publishedAt } : {}),
      registeredAt,
      refreshPolicy: "manual",
      lifecycle: "active",
    },
  };
}

function chunkText(documentId: DocumentId, profileId: string, sourceId: SourceId, text: string, at: IsoInstant): KnowledgeChunk[] {
  const paragraphs = text.split(/\n\s*\n/u).map((paragraph) => paragraph.trim()).filter(Boolean);
  return paragraphs.map((paragraph, ordinal) => ({
    id: `${documentId}:chunk:${hash(text)}:${ordinal}`,
    profileId,
    documentId,
    sourceId,
    text: paragraph,
    ordinal,
    contentHash: hash(paragraph),
    lifecycle: "active",
    ingestedAt: at,
  }));
}

export class InMemoryKnowledgeStore {
  private readonly sources = new Map<SourceId, SourceRecord>();
  private readonly chunks = new Map<string, KnowledgeChunk>();
  private readonly audits: IngestionAudit[] = [];

  ingest(profile: KnowledgeProfile, input: CorpusDocumentInput, at: IsoInstant): IngestionAudit {
    let parsed: ParsedDocument;
    try {
      parsed = parseDocument(input, at);
      if (!profile.allowedSourceIds.includes(parsed.source.id)) {
        throw new Error(`Source '${parsed.source.id}' is not approved for profile '${profile.id}'.`);
      }
    } catch (error) {
      const audit: IngestionAudit = {
        documentId: input.filename,
        status: "failed",
        chunkCount: 0,
        at,
        errors: [error instanceof Error ? error.message : "Unknown ingestion error."],
      };
      this.audits.push(audit);
      return audit;
    }

    const previous = [...this.chunks.values()].filter(
      (chunk) => chunk.documentId === parsed.documentId && chunk.lifecycle === "active",
    );
    const nextChunks = chunkText(parsed.documentId, profile.id, parsed.source.id, parsed.text, at);
    for (const chunk of previous) this.chunks.set(chunk.id, { ...chunk, lifecycle: "superseded" });
    this.sources.set(parsed.source.id, parsed.source);
    for (const chunk of nextChunks) this.chunks.set(chunk.id, chunk);

    const audit: IngestionAudit = {
      documentId: parsed.documentId,
      sourceId: parsed.source.id,
      status: previous.length === 0 ? "added" : "updated",
      chunkCount: nextChunks.length,
      contentHash: hash(parsed.text),
      at,
      errors: [],
    };
    this.audits.push(audit);
    return audit;
  }

  withdraw(documentId: DocumentId, at: IsoInstant): IngestionAudit {
    const matching = [...this.chunks.values()].filter(
      (chunk) => chunk.documentId === documentId && chunk.lifecycle === "active",
    );
    for (const chunk of matching) this.chunks.set(chunk.id, { ...chunk, lifecycle: "withdrawn" });
    const audit: IngestionAudit = {
      documentId,
      status: "withdrawn",
      chunkCount: matching.length,
      at,
      errors: matching.length === 0 ? ["No active chunks found for document."] : [],
    };
    this.audits.push(audit);
    return audit;
  }

  snapshot(): IngestionSnapshot {
    return {
      sources: [...this.sources.values()],
      chunks: [...this.chunks.values()],
      audits: [...this.audits],
    };
  }

  activeChunks(): readonly KnowledgeChunk[] {
    return [...this.chunks.values()].filter((chunk) => chunk.lifecycle === "active");
  }
}

export function isRetrievable(status: LifecycleStatus): boolean {
  return status === "active";
}
