import { access } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import {
  closeDatabase,
  getDatabase,
  getDatabasePath,
  initializeSchema,
  openDatabase,
} from "../src/index.ts";

describe("database", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "grimoire-db-"));
  });

  afterEach(() => {
    closeDatabase();
    return rm(tempDir, { recursive: true, force: true });
  });

  test("getDatabasePath returns correct path", () => {
    const path = getDatabasePath("/projects/myapp");
    expect(path).toBe(join("/projects/myapp", ".grimoire", ".cache", "grimoire.duckdb"));
  });

  test("openDatabase creates the database file", async () => {
    const connection = await openDatabase(tempDir);
    expect(connection).toBeDefined();

    const dbPath = getDatabasePath(tempDir);
    await expect(access(dbPath)).resolves.toBeUndefined();
  });

  test("openDatabase is idempotent (returns same connection)", async () => {
    const conn1 = await openDatabase(tempDir);
    const conn2 = await openDatabase(tempDir);
    expect(conn1).toBe(conn2);
  });

  test("closeDatabase is idempotent", () => {
    closeDatabase();
    closeDatabase();
  });

  test("initializeSchema creates all tables", async () => {
    const connection = await openDatabase(tempDir);
    await initializeSchema(connection);

    const reader = await connection.runAndReadAll(
      "SELECT table_name FROM duckdb_tables() ORDER BY table_name",
    );
    const tables = reader.getRows().map((row) => row[0]);

    expect(tables).toContain("_meta");
    expect(tables).toContain("changelog_entries");
    expect(tables).toContain("documents");
    expect(tables).toContain("relationships");
  });

  test("initializeSchema is idempotent", async () => {
    const connection = await openDatabase(tempDir);
    await initializeSchema(connection);
    await initializeSchema(connection);

    const reader = await connection.runAndReadAll("SELECT count(*) FROM duckdb_tables()");
    const count = reader.getRows()[0]![0];
    expect(count).toBe(4n);
  });

  test("_meta contains correct schema version", async () => {
    const connection = await getDatabase(tempDir);

    const reader = await connection.runAndReadAll(
      "SELECT value FROM _meta WHERE key = 'schema_version'",
    );
    const version = reader.getRows()[0]![0];
    expect(version).toBe("1");
  });

  test("getDatabase opens and initializes schema", async () => {
    const connection = await getDatabase(tempDir);

    const reader = await connection.runAndReadAll(
      "SELECT table_name FROM duckdb_tables() ORDER BY table_name",
    );
    const tables = reader.getRows().map((row) => row[0]);

    expect(tables).toContain("documents");
    expect(tables).toContain("relationships");
    expect(tables).toContain("changelog_entries");
  });

  test("changelog_entries sequence auto-generates IDs", async () => {
    const connection = await getDatabase(tempDir);

    // Insert a document first (FK target)
    await connection.run(`
      INSERT INTO documents (id, title, type, filepath, body)
      VALUES ('doc-1', 'Test', 'feature', 'features/test.md', 'body')
    `);

    // Insert changelog entries without specifying id
    await connection.run(`
      INSERT INTO changelog_entries (document_id, date, content)
      VALUES ('doc-1', '2026-03-29', 'First entry')
    `);
    await connection.run(`
      INSERT INTO changelog_entries (document_id, date, content)
      VALUES ('doc-1', '2026-03-30', 'Second entry')
    `);

    const reader = await connection.runAndReadAll("SELECT id FROM changelog_entries ORDER BY id");
    const ids = reader.getRows().map((row) => row[0]);
    expect(ids).toEqual([1, 2]);
  });

  test("documents table has expected columns", async () => {
    const connection = await getDatabase(tempDir);

    const reader = await connection.runAndReadAll(`
      SELECT column_name FROM duckdb_columns()
      WHERE table_name = 'documents'
      ORDER BY column_name
    `);
    const columns = reader.getRows().map((row) => row[0]);

    expect(columns).toContain("id");
    expect(columns).toContain("title");
    expect(columns).toContain("type");
    expect(columns).toContain("status");
    expect(columns).toContain("priority");
    expect(columns).toContain("created");
    expect(columns).toContain("updated");
    expect(columns).toContain("tags");
    expect(columns).toContain("filepath");
    expect(columns).toContain("body");
    expect(columns).toContain("embedding");
    expect(columns).toContain("frontmatter");
  });
});
