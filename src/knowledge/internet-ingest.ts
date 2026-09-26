import { createHash } from "node:crypto";
import { SqliteKnowledgeStore } from "./sqlite-store.js";

export interface ApprovedInternetSource {
  id: string;
  canonicalUrl: string;
  title: string;
  publisher: string;
  license: string;
  licenseUrl: string;
  allowedHost: string;
}

export const approvedInternetSources: Readonly<Record<string, ApprovedInternetSource>> = Object.freeze({
  "sqlite-appropriate-uses": Object.freeze({
    id: "sqlite-appropriate-uses",
    canonicalUrl: "https://www.sqlite.org/whentouse.html",
    title: "Appropriate Uses For SQLite",
    publisher: "SQLite",
    license: "Public Domain",
    licenseUrl: "https://www.sqlite.org/copyright.html",
    allowedHost: "www.sqlite.org",
  }),
});

function assertAllowed(url: URL, source: ApprovedInternetSource): void {
  if (url.protocol !== "https:" || url.hostname !== source.allowedHost || url.username || url.password || url.port) throw new Error("URL is outside the approved HTTPS source.");
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rarr: "→" };
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/giu, (match, entity: string) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return named[entity.toLowerCase()] ?? match;
  });
}

export function htmlToText(html: string): string {
  const selected = /<div\s+class=(?:["']?fancy["']?)\s*>\s*([\s\S]*)/iu.exec(html)?.[1]
    ?? /<main\b[^>]*>([\s\S]*?)<\/main>/iu.exec(html)?.[1]
    ?? /<article\b[^>]*>([\s\S]*?)<\/article>/iu.exec(html)?.[1]
    ?? /<body\b[^>]*>([\s\S]*?)(?:<\/body>|$)/iu.exec(html)?.[1];
  if (!selected) throw new Error("HTML has no main, article, or body content.");
  const text = selected
    .replace(/<(script|style|nav|header|footer|form|svg)\b[^>]*>[\s\S]*?<\/\1>/giu, " ")
    .replace(/<\/?(p|div|section|article|main|h[1-6]|li|dt|dd|pre|blockquote|tr|br|hr)\b[^>]*>/giu, "\n")
    .replace(/<[^>]+>/gu, " ");
  return decodeEntities(text).replace(/\r/gu, "").split("\n").map((line) => line.replace(/\s+/gu, " ").trim()).filter(Boolean).join("\n\n");
}

export function chunkText(text: string, maxCharacters = 1200): string[] {
  if (!text.trim() || !Number.isInteger(maxCharacters) || maxCharacters < 200) throw new Error("Invalid text or chunk size.");
  const paragraphs = text.split(/\n\s*\n/gu).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    const parts: string[] = [];
    let rest = paragraph;
    while (rest.length > maxCharacters) {
      const space = rest.lastIndexOf(" ", maxCharacters);
      let end = space > 0 ? space : maxCharacters;
      const previous = rest.charCodeAt(end - 1);
      if (previous >= 0xd800 && previous <= 0xdbff) end--;
      parts.push(rest.slice(0, end).trim());
      rest = rest.slice(end).trimStart();
    }
    if (rest) parts.push(rest);
    for (const part of parts) {
      if (current && current.length + 2 + part.length > maxCharacters) { chunks.push(current); current = ""; }
      current = current ? `${current}\n\n${part}` : part;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export interface FetchOptions { fetch?: typeof fetch; now?: () => string; timeoutMs?: number; maxBytes?: number; }

async function fetchApproved(source: ApprovedInternetSource, options: FetchOptions): Promise<{ html: string; fetchedAt: string }> {
  const fetcher = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15000;
  const maxBytes = options.maxBytes ?? 2_000_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || !Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("Invalid fetch limits.");
  let url = new URL(source.canonicalUrl);
  for (let redirects = 0; redirects <= 3; redirects++) {
    assertAllowed(url, source);
    const controller = new AbortController();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let timer: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { reject(new Error("Fetch timed out.")); controller.abort(); }, timeoutMs);
    });
    try {
    const response = await Promise.race([fetcher(url, { redirect: "manual", signal: controller.signal, headers: { "user-agent": "jc-model-knowledge-ingester/0.1" } }), deadline]);
    reader = response.body?.getReader();
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirects === 3) throw new Error("Invalid or excessive redirect.");
      url = new URL(location, url); continue;
    }
    if (!response.ok) throw new Error(`Fetch failed with HTTP ${response.status}.`);
    const type = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!type.includes("text/html")) throw new Error("Approved source did not return HTML.");
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) throw new Error("Response exceeds size limit.");
    if (!reader) throw new Error("Empty response body.");
    let size = 0, html = "";
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("Response exceeds size limit.");
      html += decoder.decode(value, { stream: true });
    }
    html += decoder.decode();
    return { html, fetchedAt: options.now?.() ?? new Date().toISOString() };
    } finally {
      clearTimeout(timer!);
      void reader?.cancel().catch(() => undefined);
      controller.abort();
    }
  }
  throw new Error("Redirect limit exceeded.");
}

export async function ingestApprovedSource(store: SqliteKnowledgeStore, sourceId: string, options: FetchOptions = {}) {
  const source = approvedInternetSources[sourceId];
  if (!source) throw new Error("Source is not approved.");
  const failureAt = options.now?.() ?? new Date().toISOString();
  try {
    const { html, fetchedAt } = await fetchApproved(source, options);
    const text = htmlToText(html);
    const chunks = chunkText(text);
    return store.ingest({ sourceId: source.id, canonicalUrl: source.canonicalUrl, title: source.title, publisher: source.publisher,
      license: source.license, licenseUrl: source.licenseUrl, fetchedAt, contentHash: createHash("sha256").update(text).digest("hex"), text, chunks });
  } catch (error) {
    store.recordFailure(source.id, failureAt, error instanceof Error ? error.message : "Unknown ingestion error.");
    throw error;
  }
}
