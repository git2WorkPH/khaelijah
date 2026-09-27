import { DatabaseSync, backup } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { open, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { requireDiskSpace } from "./disk-budget.js";
import {
  validateSubmission,
  validateReview,
  type SourceSubmission,
  type SourceReview,
  type RegisteredSource,
} from "./source-policy.js";

export interface StoredDocument {
  sourceId: string;
  canonicalUrl: string;
  title: string;
  publisher: string;
  license: string;
  licenseUrl: string;
  fetchedAt: string;
  contentHash: string;
  text: string;
  chunks: readonly string[];
}

export interface KnowledgeSearchResult {
  chunkId: number;
  documentId: number;
  ordinal: number;
  score: number;
  sourceId: string;
  title: string;
  canonicalUrl: string;
  publisher: string;
  license: string;
  licenseUrl: string;
  fetchedAt: string;
  contentHash: string;
  version: number;
  text: string;
  rank: number;
}

export class SqliteKnowledgeStore implements Disposable {
  private readonly db: DatabaseSync;
  constructor(path: string, options: { readOnly?: boolean } = {}) {
    this.db = new DatabaseSync(path, {
      timeout: 5000,
      readOnly: options.readOnly ?? false,
    });
    const version = Number(
      (this.db.prepare("PRAGMA user_version").get() as { user_version: number })
        .user_version,
    );
    if (version > 1) {
      this.db.close();
      throw new Error("Unsupported knowledge schema version.");
    }
    if (options.readOnly) return; // Prompting must not create/migrate or write a database.
    this.db.exec(
      "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;",
    );
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sources(
        id TEXT PRIMARY KEY, canonical_url TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
        publisher TEXT NOT NULL, license TEXT NOT NULL, license_url TEXT NOT NULL,
        lifecycle TEXT NOT NULL DEFAULT 'active' CHECK(lifecycle IN ('active','withdrawn'))
      ) STRICT;
      CREATE TABLE IF NOT EXISTS documents(
        id INTEGER PRIMARY KEY, source_id TEXT NOT NULL REFERENCES sources(id), version INTEGER NOT NULL,
        fetched_at TEXT NOT NULL, content_hash TEXT NOT NULL, text TEXT NOT NULL,
        lifecycle TEXT NOT NULL CHECK(lifecycle IN ('active','superseded','withdrawn')),
        UNIQUE(source_id, version)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS chunks(
        id INTEGER PRIMARY KEY, document_id INTEGER NOT NULL REFERENCES documents(id), ordinal INTEGER NOT NULL,
        text TEXT NOT NULL, lifecycle TEXT NOT NULL CHECK(lifecycle IN ('active','superseded','withdrawn')),
        UNIQUE(document_id, ordinal)
      ) STRICT;
      CREATE VIRTUAL TABLE IF NOT EXISTS chunk_search USING fts5(text, content='chunks', content_rowid='id');
      CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
        INSERT INTO chunk_search(rowid,text) VALUES(new.id,new.text);
      END;
      CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
        INSERT INTO chunk_search(chunk_search,rowid,text) VALUES('delete',old.id,old.text);
      END;
      CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE OF text ON chunks BEGIN
        INSERT INTO chunk_search(chunk_search,rowid,text) VALUES('delete',old.id,old.text);
        INSERT INTO chunk_search(rowid,text) VALUES(new.id,new.text);
      END;
      CREATE TABLE IF NOT EXISTS refresh_runs(
        id INTEGER PRIMARY KEY, source_id TEXT NOT NULL, started_at TEXT NOT NULL, completed_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('added','updated','unchanged','failed')),
        content_hash TEXT, chunk_count INTEGER NOT NULL, error TEXT
      ) STRICT;
    `);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.exec(`CREATE TABLE IF NOT EXISTS source_registry(
        id TEXT PRIMARY KEY, submission TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','withdrawn')),
        review TEXT, revision INTEGER NOT NULL DEFAULT 1, last_attempt INTEGER NOT NULL DEFAULT 0);
        CREATE UNIQUE INDEX IF NOT EXISTS registry_url ON source_registry(json_extract(submission,'$.url'));
        CREATE TABLE IF NOT EXISTS source_events(id INTEGER PRIMARY KEY, source_id TEXT NOT NULL, action TEXT NOT NULL, at TEXT NOT NULL, detail TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS knowledge_lease(id INTEGER PRIMARY KEY CHECK(id=1), token TEXT NOT NULL, expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS source_previews(source_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, created INTEGER NOT NULL, hash TEXT NOT NULL, document TEXT NOT NULL);
        PRAGMA user_version=1;`);
      // Preserve the previously reviewed, hard-coded public-domain source; training is not approved.
      this.db
        .prepare(
          "INSERT OR IGNORE INTO source_registry(id,submission,status,review) VALUES(?,?,'approved',?)",
        )
        .run(
          "sqlite-appropriate-uses",
          JSON.stringify({
            id: "sqlite-appropriate-uses",
            url: "https://www.sqlite.org/whentouse.html",
            title: "Appropriate Uses For SQLite",
            publisher: "SQLite",
            profileId: "technology-sqlite",
            license: "Public Domain",
            licenseUrl: "https://www.sqlite.org/copyright.html",
            refreshSeconds: 60,
          }),
          JSON.stringify({
            reviewer: "TASK-013-reviewed-source",
            reviewedAt: "2026-09-27T00:00:00.000Z",
            reason:
              "Migration of existing reviewed retrieval source; review evidence recorded in TASK-013.",
            retrievalAllowed: true,
            trainingAllowed: false,
            robotsUrl: "https://www.sqlite.org/robots.txt",
            robotsAllowed: true,
            termsUrl: "https://www.sqlite.org/copyright.html",
          }),
        );
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      this.db.close();
      throw error;
    }
  }

  private event(id: string, action: string, detail: unknown): void {
    this.db
      .prepare(
        "INSERT INTO source_events(source_id,action,at,detail) VALUES(?,?,?,?)",
      )
      .run(id, action, new Date().toISOString(), JSON.stringify(detail));
  }

  registeredSource(id: string): RegisteredSource | undefined {
    const exists = this.db
      .prepare("SELECT name FROM sqlite_master WHERE name='source_registry'")
      .get();
    if (!exists) return undefined; // Read-only pre-migration databases remain searchable.
    const row = this.db
      .prepare(
        "SELECT submission,status,review FROM source_registry WHERE id=?",
      )
      .get(id) as
      | {
          submission: string;
          status: RegisteredSource["status"];
          review: string | null;
        }
      | undefined;
    return row
      ? {
          ...JSON.parse(row.submission),
          status: row.status,
          review: row.review ? JSON.parse(row.review) : null,
        }
      : undefined;
  }
  registeredSources(): RegisteredSource[] {
    if (
      !this.db
        .prepare("SELECT name FROM sqlite_master WHERE name='source_registry'")
        .get()
    )
      return [];
    return (
      this.db.prepare("SELECT id FROM source_registry ORDER BY id").all() as {
        id: string;
      }[]
    ).map((row) => this.registeredSource(row.id)!);
  }
  approvedSourceIds(profileId: string): string[] {
    const sources = this.registeredSources();
    if (!sources.length)
      return profileId === "technology-sqlite"
        ? ["sqlite-appropriate-uses"]
        : [];
    return sources
      .filter((s) => s.profileId === profileId && s.status === "approved")
      .map((s) => s.id);
  }
  submitSource(value: SourceSubmission): void {
    const source = validateSubmission(value);
    if (
      this.db
        .prepare("SELECT id FROM sources WHERE canonical_url=?")
        .get(source.url) ||
      this.registeredSources().some((s) => s.url === source.url)
    )
      throw new Error("Source URL is already registered.");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare(
          "INSERT INTO source_registry(id,submission,status) VALUES(?,?,'pending')",
        )
        .run(source.id, JSON.stringify(source));
      this.event(source.id, "submitted", source);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  reviewSource(id: string, review: SourceReview, reactivate = false): void {
    validateReview(review);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const source = this.registeredSource(id);
      if (!source) throw new Error("Unknown source.");
      if (review.robotsUrl !== new URL("/robots.txt", source.url).href) throw new Error("Robots review must reference this source origin's robots.txt.");
      if (source.status === "withdrawn" && !reactivate)
        throw new Error("Withdrawn source needs explicit reactivation.");
      const approved = review.retrievalAllowed && review.robotsAllowed;
      if (reactivate && (source.status !== "withdrawn" || !approved))
        throw new Error("Reactivation needs a new permitting review.");
      this.db
        .prepare(
          "UPDATE source_registry SET status=?,review=?,revision=revision+1 WHERE id=?",
        )
        .run(approved ? "approved" : "rejected", JSON.stringify(review), id);
      this.db.prepare("DELETE FROM source_previews WHERE source_id=?").run(id);
      if (!approved) this.withdrawRows(id);
      else if (reactivate || source.status === "rejected")
        this.db
          .prepare("UPDATE sources SET lifecycle='active' WHERE id=?")
          .run(id); // Historical chunks stay withdrawn until a fresh ingestion.
      this.event(id, reactivate ? "reactivated" : "reviewed", review);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  private withdrawRows(id: string): void {
    this.db
      .prepare("UPDATE sources SET lifecycle='withdrawn' WHERE id=?")
      .run(id);
    this.db
      .prepare(
        "UPDATE chunks SET lifecycle='withdrawn' WHERE document_id IN (SELECT id FROM documents WHERE source_id=?) AND lifecycle='active'",
      )
      .run(id);
    this.db
      .prepare(
        "UPDATE documents SET lifecycle='withdrawn' WHERE source_id=? AND lifecycle='active'",
      )
      .run(id);
  }
  withdrawSource(id: string, reviewer: string, reason: string): void {
    if (!reviewer.trim() || !reason.trim())
      throw new Error("Withdrawal requires reviewer and reason.");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (!this.registeredSource(id)) throw new Error("Unknown source.");
      this.db
        .prepare(
          "UPDATE source_registry SET status='withdrawn',revision=revision+1 WHERE id=?",
        )
        .run(id);
      this.db.prepare("DELETE FROM source_previews WHERE source_id=?").run(id);
      this.withdrawRows(id);
      this.event(id, "withdrawn", { reviewer, reason });
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  acquireRefresh(id: string, now = Date.now()): string {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const source = this.registeredSource(id);
      if (!source || source.status !== "approved")
        throw new Error("Source is not approved.");
      const row = this.db
        .prepare("SELECT last_attempt FROM source_registry WHERE id=?")
        .get(id) as { last_attempt: number };
      if (now - row.last_attempt < source.refreshSeconds * 1000)
        throw new Error("Source refresh rate limit.");
      this.db.prepare("DELETE FROM knowledge_lease WHERE expires<=?").run(now);
      const token = randomUUID();
      this.db
        .prepare("INSERT INTO knowledge_lease(id,token,expires) VALUES(1,?,?)")
        .run(token, now + 120000);
      this.db
        .prepare("UPDATE source_registry SET last_attempt=? WHERE id=?")
        .run(now, id);
      this.event(id, "fetch_started", { token });
      this.db.exec("COMMIT");
      return token;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  releaseRefresh(token: string): void {
    this.db.prepare("DELETE FROM knowledge_lease WHERE token=?").run(token);
  }
  stagePreview(document: StoredDocument, token: string): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (
        !this.db
          .prepare(
            "SELECT token FROM knowledge_lease WHERE token=? AND expires>?",
          )
          .get(token, Date.now())
      )
        throw new Error("Refresh lease expired.");
      const row = this.db
        .prepare("SELECT revision,status FROM source_registry WHERE id=?")
        .get(document.sourceId) as { revision: number; status: string };
      if (row?.status !== "approved")
        throw new Error("Source no longer approved.");
      const source = this.registeredSource(document.sourceId)!;
      if (
        source.url !== document.canonicalUrl ||
        source.license !== document.license ||
        source.licenseUrl !== document.licenseUrl
      )
        throw new Error("Source policy changed during fetch.");
      this.db
        .prepare(
          "INSERT INTO source_previews(source_id,revision,created,hash,document) VALUES(?,?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET revision=excluded.revision,created=excluded.created,hash=excluded.hash,document=excluded.document",
        )
        .run(
          document.sourceId,
          row.revision,
          Date.now(),
          document.contentHash,
          JSON.stringify(document),
        );
      this.event(document.sourceId, "preview_ready", {
        hash: document.contentHash,
      });
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  preview(id: string): StoredDocument | undefined {
    const row = this.db
      .prepare("SELECT document FROM source_previews WHERE source_id=?")
      .get(id) as { document: string } | undefined;
    return row ? (JSON.parse(row.document) as StoredDocument) : undefined;
  }
  commitPreview(id: string, hash: string) {
    const row = this.db
      .prepare(
        "SELECT p.document,p.revision FROM source_previews p JOIN source_registry r ON r.id=p.source_id WHERE p.source_id=? AND p.hash=? AND p.revision=r.revision AND r.status='approved' AND p.created>?",
      )
      .get(id, hash, Date.now() - 86400000) as { document: string; revision: number } | undefined;
    if (!row)
      throw new Error("Preview missing, expired, changed or not approved.");
    // ingest rechecks approval under its own write transaction.
    return this.ingest(JSON.parse(row.document) as StoredDocument, { hash, revision: row.revision });
  }
  health(): {
    schemaVersion: number;
    integrity: unknown[];
    foreignKeys: unknown[];
  } {
    return {
      schemaVersion: Number(
        (
          this.db.prepare("PRAGMA user_version").get() as {
            user_version: number;
          }
        ).user_version,
      ),
      integrity: this.db.prepare("PRAGMA integrity_check").all(),
      foreignKeys: this.db.prepare("PRAGMA foreign_key_check").all(),
    };
  }
  async backupTo(path: string): Promise<void> {
    const pages = Number(
      (this.db.prepare("PRAGMA page_count").get() as { page_count: number })
        .page_count,
    );
    const pageSize = Number((this.db.prepare("PRAGMA page_size").get() as { page_size: number }).page_size);
    requireDiskSpace(dirname(path), pages * pageSize * 2 + 10_000_000);
    const owned = await open(path, "wx", 0o600);
    await owned.close();
    try {
      await backup(this.db, path);
      const check = new DatabaseSync(path, { readOnly: true });
      try {
        const integrity = check.prepare("PRAGMA integrity_check").all() as { integrity_check: string }[];
        if (integrity.length !== 1 || integrity[0]?.integrity_check !== "ok" || check.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Backup integrity verification failed.");
      } finally { check.close(); }
    } catch (error) {
      await unlink(path);
      throw error;
    }
  }
  sourceEvents(): Record<string, unknown>[] {
    return this.db
      .prepare("SELECT * FROM source_events ORDER BY id")
      .all() as Record<string, unknown>[];
  }

  ingest(document: StoredDocument, expectedPreview?: { hash: string; revision: number }): {
    status: "added" | "updated" | "unchanged";
    version: number;
    chunkCount: number;
  } {
    if (
      !document.chunks.length ||
      document.chunks.some((chunk) => !chunk.trim())
    )
      throw new Error("Document needs non-empty chunks.");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const registered = this.registeredSource(document.sourceId);
      if (expectedPreview) {
        const currentPreview = this.db.prepare("SELECT p.document FROM source_previews p JOIN source_registry r ON r.id=p.source_id WHERE p.source_id=? AND p.hash=? AND p.revision=? AND r.revision=p.revision AND r.status='approved' AND p.created>?").get(document.sourceId, expectedPreview.hash, expectedPreview.revision, Date.now() - 86400000) as { document: string } | undefined;
        if (!currentPreview || currentPreview.document !== JSON.stringify(document)) throw new Error("Preview or review changed before commit.");
        this.db.prepare("DELETE FROM source_previews WHERE source_id=?").run(document.sourceId);
        this.event(document.sourceId, "preview_committed", expectedPreview);
      }
      if (
        registered &&
        registered.status !== "approved"
      )
        throw new Error("Source policy does not permit ingestion.");
      if (
        (
          this.db
            .prepare("SELECT lifecycle FROM sources WHERE id=?")
            .get(document.sourceId) as { lifecycle: string } | undefined
        )?.lifecycle === "withdrawn"
      )
        throw new Error("Source is withdrawn; explicit reactivation required.");
      this.db
        .prepare(
          `INSERT INTO sources(id,canonical_url,title,publisher,license,license_url)
        VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET canonical_url=excluded.canonical_url,title=excluded.title,
        publisher=excluded.publisher,license=excluded.license,license_url=excluded.license_url,lifecycle='active'`,
        )
        .run(
          document.sourceId,
          document.canonicalUrl,
          document.title,
          document.publisher,
          document.license,
          document.licenseUrl,
        );
      const current = this.db
        .prepare(
          "SELECT id,version,content_hash FROM documents WHERE source_id=? AND lifecycle='active'",
        )
        .get(document.sourceId) as
        | { id: number; version: number; content_hash: string }
        | undefined;
      if (current?.content_hash === document.contentHash) {
        this.db
          .prepare(
            "INSERT INTO refresh_runs(source_id,started_at,completed_at,status,content_hash,chunk_count) VALUES(?,?,?,?,?,?)",
          )
          .run(
            document.sourceId,
            document.fetchedAt,
            document.fetchedAt,
            "unchanged",
            document.contentHash,
            document.chunks.length,
          );
        this.db.exec("COMMIT");
        return {
          status: "unchanged",
          version: current.version,
          chunkCount: document.chunks.length,
        };
      }
      if (current) {
        this.db
          .prepare("UPDATE documents SET lifecycle='superseded' WHERE id=?")
          .run(current.id);
        this.db
          .prepare(
            "UPDATE chunks SET lifecycle='superseded' WHERE document_id=?",
          )
          .run(current.id);
      }
      const version =
        Number(
          (
            this.db
              .prepare(
                "SELECT coalesce(max(version),0) version FROM documents WHERE source_id=?",
              )
              .get(document.sourceId) as { version: number }
          ).version,
        ) + 1;
      const inserted = this.db
        .prepare(
          "INSERT INTO documents(source_id,version,fetched_at,content_hash,text,lifecycle) VALUES(?,?,?,?,?,'active')",
        )
        .run(
          document.sourceId,
          version,
          document.fetchedAt,
          document.contentHash,
          document.text,
        );
      const insertChunk = this.db.prepare(
        "INSERT INTO chunks(document_id,ordinal,text,lifecycle) VALUES(?,?,?,'active')",
      );
      document.chunks.forEach((chunk, ordinal) =>
        insertChunk.run(inserted.lastInsertRowid, ordinal, chunk),
      );
      const status = current ? "updated" : "added";
      this.db
        .prepare(
          "INSERT INTO refresh_runs(source_id,started_at,completed_at,status,content_hash,chunk_count) VALUES(?,?,?,?,?,?)",
        )
        .run(
          document.sourceId,
          document.fetchedAt,
          document.fetchedAt,
          status,
          document.contentHash,
          document.chunks.length,
        );
      this.db.exec("COMMIT");
      return { status, version, chunkCount: document.chunks.length };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  recordFailure(sourceId: string, at: string, error: string): void {
    this.db
      .prepare(
        "INSERT INTO refresh_runs(source_id,started_at,completed_at,status,chunk_count,error) VALUES(?,?,?,'failed',0,?)",
      )
      .run(sourceId, at, at, error.slice(0, 2000));
  }

  search(
    query: string,
    limit = 5,
    allowedSourceIds?: readonly string[],
  ): KnowledgeSearchResult[] {
    const terms =
      query
        .toLowerCase()
        .match(/[a-z0-9]+/gu)
        ?.filter((term) => term.length > 1) ?? [];
    if (!terms.length || !Number.isInteger(limit) || limit < 1 || limit > 50)
      return [];
    if (allowedSourceIds && !allowedSourceIds.length) return [];
    const sourceFilter = allowedSourceIds
      ? ` AND s.id IN (${allowedSourceIds.map(() => "?").join(",")})`
      : "";
    const expression = terms.map((term) => `"${term}"`).join(" OR ");
    const rows = this.db
      .prepare(
        `SELECT c.id chunk_id,d.id document_id,c.ordinal,s.id source_id,s.title,s.canonical_url,s.publisher,s.license,s.license_url,
      d.fetched_at,d.content_hash,d.version,c.text,bm25(chunk_search) score
      FROM chunk_search JOIN chunks c ON c.id=chunk_search.rowid JOIN documents d ON d.id=c.document_id
      JOIN sources s ON s.id=d.source_id WHERE chunk_search MATCH ? AND c.lifecycle='active' AND d.lifecycle='active' AND s.lifecycle='active'
      ${sourceFilter} ORDER BY score,c.id LIMIT ?`,
      )
      .all(expression, ...(allowedSourceIds ?? []), limit) as Record<
      string,
      unknown
    >[];
    return rows.map((row, index) => this.searchResult(row, index + 1));
  }

  activeChunk(id: number): KnowledgeSearchResult | undefined {
    if (!Number.isSafeInteger(id) || id < 1) return undefined;
    const row = this.db
      .prepare(
        `SELECT c.id chunk_id,d.id document_id,c.ordinal,s.id source_id,s.title,s.canonical_url,s.publisher,s.license,s.license_url,
      d.fetched_at,d.content_hash,d.version,c.text,0 score FROM chunks c JOIN documents d ON d.id=c.document_id
      JOIN sources s ON s.id=d.source_id WHERE c.id=? AND c.lifecycle='active' AND d.lifecycle='active' AND s.lifecycle='active'`,
      )
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.searchResult(row, 0) : undefined;
  }

  private searchResult(
    row: Record<string, unknown>,
    rank: number,
  ): KnowledgeSearchResult {
    return {
      documentId: Number(row.document_id),
      ordinal: Number(row.ordinal),
      score: Number(row.score),
      chunkId: Number(row.chunk_id),
      sourceId: String(row.source_id),
      title: String(row.title),
      canonicalUrl: String(row.canonical_url),
      publisher: String(row.publisher),
      license: String(row.license),
      licenseUrl: String(row.license_url),
      fetchedAt: String(row.fetched_at),
      contentHash: String(row.content_hash),
      version: Number(row.version),
      text: String(row.text),
      rank,
    };
  }

  audits(): Record<string, unknown>[] {
    return this.db
      .prepare("SELECT * FROM refresh_runs ORDER BY id")
      .all() as Record<string, unknown>[];
  }
  close(): void {
    this.db.close();
  }
  [Symbol.dispose](): void {
    this.close();
  }
}
