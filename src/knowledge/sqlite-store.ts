import { DatabaseSync } from "node:sqlite";

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
  constructor(path: string) {
    this.db = new DatabaseSync(path, { timeout: 5000 });
    this.db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;");
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
  }

  ingest(document: StoredDocument): { status: "added" | "updated" | "unchanged"; version: number; chunkCount: number } {
    if (!document.chunks.length || document.chunks.some((chunk) => !chunk.trim())) throw new Error("Document needs non-empty chunks.");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare(`INSERT INTO sources(id,canonical_url,title,publisher,license,license_url)
        VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET canonical_url=excluded.canonical_url,title=excluded.title,
        publisher=excluded.publisher,license=excluded.license,license_url=excluded.license_url,lifecycle='active'`)
        .run(document.sourceId, document.canonicalUrl, document.title, document.publisher, document.license, document.licenseUrl);
      const current = this.db.prepare("SELECT id,version,content_hash FROM documents WHERE source_id=? AND lifecycle='active'").get(document.sourceId) as { id: number; version: number; content_hash: string } | undefined;
      if (current?.content_hash === document.contentHash) {
        this.db.prepare("INSERT INTO refresh_runs(source_id,started_at,completed_at,status,content_hash,chunk_count) VALUES(?,?,?,?,?,?)")
          .run(document.sourceId, document.fetchedAt, document.fetchedAt, "unchanged", document.contentHash, document.chunks.length);
        this.db.exec("COMMIT");
        return { status: "unchanged", version: current.version, chunkCount: document.chunks.length };
      }
      if (current) {
        this.db.prepare("UPDATE documents SET lifecycle='superseded' WHERE id=?").run(current.id);
        this.db.prepare("UPDATE chunks SET lifecycle='superseded' WHERE document_id=?").run(current.id);
      }
      const version = (current?.version ?? 0) + 1;
      const inserted = this.db.prepare("INSERT INTO documents(source_id,version,fetched_at,content_hash,text,lifecycle) VALUES(?,?,?,?,?,'active')")
        .run(document.sourceId, version, document.fetchedAt, document.contentHash, document.text);
      const insertChunk = this.db.prepare("INSERT INTO chunks(document_id,ordinal,text,lifecycle) VALUES(?,?,?,'active')");
      document.chunks.forEach((chunk, ordinal) => insertChunk.run(inserted.lastInsertRowid, ordinal, chunk));
      const status = current ? "updated" : "added";
      this.db.prepare("INSERT INTO refresh_runs(source_id,started_at,completed_at,status,content_hash,chunk_count) VALUES(?,?,?,?,?,?)")
        .run(document.sourceId, document.fetchedAt, document.fetchedAt, status, document.contentHash, document.chunks.length);
      this.db.exec("COMMIT");
      return { status, version, chunkCount: document.chunks.length };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  recordFailure(sourceId: string, at: string, error: string): void {
    this.db.prepare("INSERT INTO refresh_runs(source_id,started_at,completed_at,status,chunk_count,error) VALUES(?,?,?,'failed',0,?)").run(sourceId, at, at, error.slice(0, 2000));
  }

  search(query: string, limit = 5): KnowledgeSearchResult[] {
    const terms = query.toLowerCase().match(/[a-z0-9]+/gu)?.filter((term) => term.length > 1) ?? [];
    if (!terms.length || !Number.isInteger(limit) || limit < 1 || limit > 50) return [];
    const expression = terms.map((term) => `"${term}"`).join(" OR ");
    const rows = this.db.prepare(`SELECT c.id chunk_id,s.id source_id,s.title,s.canonical_url,s.publisher,s.license,s.license_url,
      d.fetched_at,d.content_hash,d.version,c.text,bm25(chunk_search) score
      FROM chunk_search JOIN chunks c ON c.id=chunk_search.rowid JOIN documents d ON d.id=c.document_id
      JOIN sources s ON s.id=d.source_id WHERE chunk_search MATCH ? AND c.lifecycle='active' AND d.lifecycle='active' AND s.lifecycle='active'
      ORDER BY score,c.id LIMIT ?`).all(expression, limit) as Record<string, unknown>[];
    return rows.map((row, index) => ({
      chunkId: Number(row.chunk_id), sourceId: String(row.source_id), title: String(row.title), canonicalUrl: String(row.canonical_url),
      publisher: String(row.publisher), license: String(row.license), licenseUrl: String(row.license_url), fetchedAt: String(row.fetched_at),
      contentHash: String(row.content_hash), version: Number(row.version), text: String(row.text), rank: index + 1,
    }));
  }

  audits(): Record<string, unknown>[] { return this.db.prepare("SELECT * FROM refresh_runs ORDER BY id").all() as Record<string, unknown>[]; }
  close(): void { this.db.close(); }
  [Symbol.dispose](): void { this.close(); }
}
