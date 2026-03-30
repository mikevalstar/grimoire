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
const SCHEMA_VERSION = 1;

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
      frontmatter JSON
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
}

export type { DuckDBConnection };
