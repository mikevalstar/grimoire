/**
 * DuckDB database setup and schema management.
 * The database is a derived cache — always rebuildable from markdown files.
 */

import { DuckDBInstance } from "@duckdb/node-api";
import type { DuckDBConnection } from "@duckdb/node-api";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";

const GRIMOIRE_DIR = ".grimoire";
const CACHE_DIR = ".cache";
const DB_FILENAME = "grimoire.duckdb";
const SCHEMA_VERSION = 3;

interface DatabaseState {
  instance: DuckDBInstance;
  connection: DuckDBConnection;
  dbPath: string;
}

let current: DatabaseState | null = null;

export function getDatabasePath(cwd: string = process.cwd()): string {
  return join(cwd, GRIMOIRE_DIR, CACHE_DIR, DB_FILENAME);
}

export async function openDatabase(cwd: string = process.cwd()): Promise<DuckDBConnection> {
  const dbPath = getDatabasePath(cwd);

  if (current && current.dbPath === dbPath) {
    return current.connection;
  }

  if (current) {
    current.connection.closeSync();
    current = null;
  }

  await mkdir(join(cwd, GRIMOIRE_DIR, CACHE_DIR), { recursive: true });

  const instance = await DuckDBInstance.create(dbPath);
  const connection = await instance.connect();

  current = { instance, connection, dbPath };

  return connection;
}

export function closeDatabase(): void {
  if (current) {
    current.connection.closeSync();
    current = null;
  }
}

export async function getDatabase(cwd: string = process.cwd()): Promise<DuckDBConnection> {
  const connection = await openDatabase(cwd);
  await initializeSchema(connection);
  return connection;
}

export async function initializeSchema(connection: DuckDBConnection): Promise<void> {
  await connection.run(`
    CREATE TABLE IF NOT EXISTS _meta (
      key VARCHAR PRIMARY KEY,
      value VARCHAR NOT NULL
    );
  `);

  await connection.run(`
    INSERT INTO _meta VALUES ('schema_version', '${SCHEMA_VERSION}')
    ON CONFLICT (key) DO UPDATE SET value = excluded.value;
  `);

  await connection.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id VARCHAR PRIMARY KEY,
      title VARCHAR NOT NULL,
      type VARCHAR NOT NULL,
      status VARCHAR,
      priority VARCHAR,
      created TIMESTAMP,
      updated TIMESTAMP,
      tags VARCHAR[],
      filepath VARCHAR NOT NULL,
      body TEXT NOT NULL,
      embedding FLOAT[768],
      frontmatter JSON,
      tags_text VARCHAR GENERATED ALWAYS AS (array_to_string(tags, ' ')) VIRTUAL
    );
  `);

  await connection.run(`
    CREATE TABLE IF NOT EXISTS relationships (
      source_id VARCHAR NOT NULL,
      target_id VARCHAR NOT NULL,
      relationship VARCHAR NOT NULL,
      PRIMARY KEY (source_id, target_id, relationship),
      FOREIGN KEY (source_id) REFERENCES documents(id),
      FOREIGN KEY (target_id) REFERENCES documents(id)
    );
  `);

  await connection.run(`CREATE SEQUENCE IF NOT EXISTS changelog_entries_id_seq START 1;`);

  await connection.run(`
    CREATE TABLE IF NOT EXISTS changelog_entries (
      id INTEGER DEFAULT nextval('changelog_entries_id_seq') PRIMARY KEY,
      document_id VARCHAR NOT NULL,
      date DATE NOT NULL,
      author VARCHAR,
      content TEXT NOT NULL,
      is_comment BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (document_id) REFERENCES documents(id)
    );
  `);

  await connection.run(`
    CREATE TABLE IF NOT EXISTS content_hashes (
      filepath VARCHAR PRIMARY KEY,
      content_hash VARCHAR NOT NULL
    );
  `);

  // Load FTS extension for full-text search
  await connection.run("INSTALL fts");
  await connection.run("LOAD fts");
}

/**
 * (Re)create the FTS index on the documents table.
 * Must be called after documents are inserted/updated (e.g. after sync).
 * Drops existing index first to ensure a clean rebuild.
 */
export async function rebuildFtsIndex(connection: DuckDBConnection): Promise<void> {
  // Drop existing FTS index if present (ignore error if it doesn't exist)
  try {
    await connection.run("PRAGMA drop_fts_index('documents')");
  } catch {
    // Index may not exist yet — that's fine
  }

  // Create FTS index on title, body, and tags_text (generated column from tags array).
  // Uses English stemmer and stopwords for natural-language BM25 ranking.
  await connection.run(
    "PRAGMA create_fts_index('documents', 'id', 'title', 'body', 'tags_text', stemmer = 'english', stopwords = 'english')",
  );
}

let vssLoaded = false;

/**
 * Ensure the VSS extension is installed and loaded.
 * Returns true if VSS is available, false otherwise.
 */
async function ensureVss(connection: DuckDBConnection): Promise<boolean> {
  if (vssLoaded) return true;
  try {
    await connection.run("INSTALL vss");
    await connection.run("LOAD vss");
    vssLoaded = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * (Re)create the HNSW vector similarity index on the documents table.
 * Must be called after embeddings are populated (e.g. after sync).
 * No-op if the vss extension isn't loaded or no embeddings exist.
 */
export async function rebuildVssIndex(connection: DuckDBConnection): Promise<void> {
  try {
    if (!(await ensureVss(connection))) return;

    // Check if any embeddings exist before creating the index
    const result = await connection.runAndReadAll(
      "SELECT COUNT(*) FROM documents WHERE embedding IS NOT NULL",
    );
    const count = result.getRows()[0]?.[0] as number;
    if (count === 0) return;

    // Drop existing index if present
    try {
      await connection.run("DROP INDEX IF EXISTS embedding_idx");
    } catch {
      // Index may not exist — that's fine
    }

    // Create HNSW index with cosine metric
    await connection.run(
      "CREATE INDEX embedding_idx ON documents USING HNSW (embedding) WITH (metric = 'cosine')",
    );
  } catch {
    // VSS extension not available or index creation failed — keyword search still works
  }
}

/**
 * Check if the VSS extension is loaded and functional.
 */
export async function isVssAvailable(connection: DuckDBConnection): Promise<boolean> {
  return ensureVss(connection);
}

export type { DuckDBConnection };
