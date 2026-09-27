import { createHash } from "node:crypto";
import { fetchApproved, htmlToText, chunkText, type FetchOptions } from "./internet-ingest.js";
import { SqliteKnowledgeStore } from "./sqlite-store.js";
import { requireDiskSpace } from "./disk-budget.js";
import { safePublicFetch } from "./safe-http.js";

/** Policy pages only; displaying them never grants content/training permission. */
export async function readSourcePolicies(store: SqliteKnowledgeStore, sourceId: string, fetcher: typeof fetch = safePublicFetch) {
  const source = store.registeredSource(sourceId);
  if (!source) throw new Error("Unknown source.");
  const result = [];
  for (const url of [...new Set([new URL("/robots.txt", source.url).href, source.licenseUrl])]) {
    const controller = new AbortController();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let timer: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("Policy fetch timed out.")); }, 15000); });
    try {
      const response = await Promise.race([fetcher(url, { redirect: "manual", signal: controller.signal }), deadline]);
      if (response.status >= 300 && response.status < 400) throw new Error("Policy redirect requires review of its exact target URL.");
      if (![200, 404].includes(response.status)) throw new Error(`Policy fetch HTTP ${response.status}; do not assume permission.`);
      if (!/text\/(plain|html)/i.test(response.headers.get("content-type") ?? "")) throw new Error("Unsupported policy content type.");
      reader = response.body?.getReader(); let bytes = 0, text = ""; const decoder = new TextDecoder();
      if (!reader) throw new Error("Empty policy body.");
      for (;;) {
        const chunk = await Promise.race([reader.read(), deadline]); if (chunk.done) break;
        bytes += chunk.value.byteLength; if (bytes > 131072) throw new Error("Policy exceeds 128 KiB limit.");
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
      result.push({ url, status: response.status, fetchedAt: new Date().toISOString(), sha256: createHash("sha256").update(text).digest("hex"), text });
    } finally { clearTimeout(timer!); void reader?.cancel().catch(() => undefined); controller.abort(); }
  }
  return { sourceId, policies: result, requiresHumanReview: true, warning: "Public access, robots permission or missing policy does not establish storage/training rights." };
}

/** Explicit fetch/preview then hash-confirmed commit. No crawler or background scheduler. */
export async function previewSource(store: SqliteKnowledgeStore, sourceId: string, directory: string, options: FetchOptions & { diskCheck?: () => void; wait?: (ms: number) => Promise<void> } = {}) {
  const source = store.registeredSource(sourceId);
  if (!source || source.status !== "approved" || !source.review?.retrievalAllowed || !source.review.robotsAllowed) throw new Error("Source lacks explicit retrieval/robots approval.");
  const diskCheck = options.diskCheck ?? (() => requireDiskSpace(directory, 16_000_000));
  diskCheck();
  const token = store.acquireRefresh(sourceId);
  try {
    let fetched: { html: string; fetchedAt: string } | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        fetched = await fetchApproved({ id: source.id, canonicalUrl: source.url, allowedHost: new URL(source.url).hostname, title: source.title, publisher: source.publisher, license: source.license, licenseUrl: source.licenseUrl }, options);
        break;
      } catch (error) {
        if (attempt || !/HTTP 50[234]/.test(String(error))) throw error;
        store.recordFailure(sourceId, new Date().toISOString(), error instanceof Error ? error.message : String(error));
        await (options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))))(1000);
      }
    }
    if (!fetched) throw new Error("No fetch result.");
    if (/<input\b[^>]*type\s*=\s*["']?password/i.test(fetched.html) || /"isAccessibleForFree"\s*:\s*false/i.test(fetched.html)) throw new Error("Login/paywall indicators detected; unsupported source.");
    const text = htmlToText(fetched.html), chunks = chunkText(text);
    const document = { sourceId, canonicalUrl: source.url, title: source.title, publisher: source.publisher, license: source.license, licenseUrl: source.licenseUrl, fetchedAt: fetched.fetchedAt, text, chunks, contentHash: createHash("sha256").update(text).digest("hex") };
    diskCheck(); store.stagePreview(document, token);
    return { source, contentHash: document.contentHash, chunks: chunks.length, text, fetchedAt: document.fetchedAt, requiresCommit: true };
  } catch (error) {
    store.recordFailure(sourceId, new Date().toISOString(), error instanceof Error ? error.message : String(error)); throw error;
  } finally { store.releaseRefresh(token); }
}
