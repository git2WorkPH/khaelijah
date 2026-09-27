import { canonicalSourceUrl } from "./safe-http.js";

export interface SourceSubmission {
  id: string;
  url: string;
  title: string;
  publisher: string;
  profileId: string;
  license: string;
  licenseUrl: string;
  refreshSeconds: number;
}
export interface SourceReview {
  reviewer: string;
  reviewedAt: string;
  reason: string;
  retrievalAllowed: boolean;
  trainingAllowed: boolean;
  robotsUrl: string;
  robotsAllowed: boolean;
  termsUrl: string;
}
export interface RegisteredSource extends SourceSubmission {
  status: "pending" | "approved" | "rejected" | "withdrawn";
  review: SourceReview | null;
}
export function validateSubmission(value: SourceSubmission): SourceSubmission {
  if (
    !value ||
    [
      value.id,
      value.title,
      value.publisher,
      value.profileId,
      value.license,
    ].some((v) => typeof v !== "string" || !v.trim() || v.length > 500)
  )
    throw new Error("Invalid source metadata.");
  if (
    !/^[a-z0-9][a-z0-9-]{0,99}$/.test(value.id) ||
    !/^technology-[a-z0-9-]+$/.test(value.profileId)
  )
    throw new Error("Only named technology source/profile IDs supported.");
  if (
    !Number.isSafeInteger(value.refreshSeconds) ||
    value.refreshSeconds < 60 ||
    value.refreshSeconds > 31536000
  )
    throw new Error("Refresh interval must be 60 seconds to one year.");
  return {
    ...value,
    url: canonicalSourceUrl(value.url),
    licenseUrl: canonicalSourceUrl(value.licenseUrl),
  };
}
export function validateReview(value: SourceReview): void {
  if (
    !value ||
    [value.reviewer, value.reason, value.reviewedAt].some(
      (v) => typeof v !== "string" || !v.trim() || v.length > 2000,
    ) ||
    !Number.isFinite(Date.parse(value.reviewedAt)) ||
    typeof value.retrievalAllowed !== "boolean" ||
    typeof value.trainingAllowed !== "boolean" ||
    typeof value.robotsAllowed !== "boolean"
  )
    throw new Error(
      "Review needs actor, reason, time and explicit permissions.",
    );
  canonicalSourceUrl(value.robotsUrl);
  canonicalSourceUrl(value.termsUrl);
}
