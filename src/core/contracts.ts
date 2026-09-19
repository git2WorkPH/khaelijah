export type IsoInstant = string;
export type ProfileId = string;
export type SourceId = string;
export type DocumentId = string;
export type ChunkId = string;

export type LifecycleStatus = "active" | "superseded" | "withdrawn";

export const lifecycleStatuses = ["active", "superseded", "withdrawn"] as const;

export function isLifecycleStatus(value: unknown): value is LifecycleStatus {
  return typeof value === "string" && lifecycleStatuses.includes(value as LifecycleStatus);
}

export interface KnowledgeProfile {
  readonly id: ProfileId;
  readonly name: string;
  readonly domain: "technology";
  readonly allowedSourceIds: readonly SourceId[];
  readonly retrievalPolicy: {
    readonly maxResults: number;
    readonly minScore: number;
  };
}

export interface SourceRecord {
  readonly id: SourceId;
  readonly title: string;
  readonly canonicalUrl: string;
  readonly publisher: string;
  readonly licenseOrAccess: string;
  readonly publishedAt?: IsoInstant;
  readonly registeredAt: IsoInstant;
  readonly refreshPolicy: "manual";
  readonly lifecycle: LifecycleStatus;
}

export interface KnowledgeChunk {
  readonly id: ChunkId;
  readonly profileId: ProfileId;
  readonly documentId: DocumentId;
  readonly sourceId: SourceId;
  readonly text: string;
  readonly ordinal: number;
  readonly contentHash: string;
  readonly lifecycle: LifecycleStatus;
  readonly ingestedAt: IsoInstant;
}

export interface RetrievalQuery {
  readonly profileId: ProfileId;
  readonly query: string;
  readonly limit: number;
  readonly retrievedAt: IsoInstant;
}

export interface RetrievedPassage {
  readonly chunk: KnowledgeChunk;
  readonly score: number;
  readonly rank: number;
  readonly source: SourceRecord;
  readonly retrievedAt: IsoInstant;
}

export interface RetrievalPort {
  retrieve(query: RetrievalQuery): Promise<readonly RetrievedPassage[]>;
}

export interface EvidencePacket {
  readonly requestId: string;
  readonly profileId: ProfileId;
  readonly query: string;
  readonly passages: readonly RetrievedPassage[];
  readonly retrievalWarnings: readonly string[];
  readonly createdAt: IsoInstant;
}

export interface InferenceRequest {
  readonly task: string;
  readonly evidence: EvidencePacket;
  readonly outputSchema: "grounded-implementation-plan-v1";
}

export interface InferencePort {
  generate(request: InferenceRequest): Promise<unknown>;
}

export interface Citation {
  readonly passageId: ChunkId;
  readonly claim: string;
}

export interface GroundedPlan {
  readonly taskSummary: string;
  readonly citations: readonly Citation[];
  readonly recommendations: readonly string[];
  readonly uncertainties: readonly string[];
}

export type GroundedResponse =
  | { readonly status: "grounded"; readonly plan: GroundedPlan; readonly evidence: EvidencePacket }
  | { readonly status: "insufficient_evidence"; readonly reason: string; readonly evidence: EvidencePacket }
  | { readonly status: "stale_evidence"; readonly reason: string; readonly evidence: EvidencePacket }
  | { readonly status: "invalid_citation"; readonly reason: string; readonly evidence: EvidencePacket };
