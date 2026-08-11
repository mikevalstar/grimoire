import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { PREF_KEYS } from "./types.ts";

/**
 * Where Grimoire keeps its own state — grimoire.db plus cached assets. One
 * path on Linux and macOS so it stays easy to document; Windows gets a folder
 * users actually browse. Override with $GRIMOIRE_DATA_DIR.
 */
export function defaultDataDir(): string {
  const override = process.env.GRIMOIRE_DATA_DIR;
  if (override) return override;

  if (process.platform === "win32") {
    return join(homedir(), "Documents", "Grimoire");
  }
  return join(homedir(), ".config", "grimoire");
}

export function defaultDatabasePath(): string {
  return join(defaultDataDir(), "grimoire.db");
}

/**
 * Open (creating if needed) Grimoire's own SQLite database and bring its schema
 * up to date. One connection is shared by every store, so migrations live here
 * rather than in whichever store happens to be constructed first.
 */
export function openDatabase(path: string = defaultDatabasePath()): Database {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path, { create: true });
  db.run("PRAGMA journal_mode = WAL");
  migrate(db);
  return db;
}

function migrate(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  // Version 0 means "never configured" — the UI takes that as its cue to run
  // first-time setup.
  db.query("INSERT OR IGNORE INTO preferences (key, value) VALUES ($key, $value)").run({
    $key: PREF_KEYS.version,
    $value: "0",
  });

  // The people sharing this library (ADR 0008). Names are unique
  // case-insensitively: two "dad"s in one household is a mistake, not a plan.
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL COLLATE NOCASE UNIQUE,
      color      TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
}

/** Accept either an open connection or a path, so stores can share one db. */
export function resolveDatabase(source: Database | string = defaultDatabasePath()): Database {
  return typeof source === "string" ? openDatabase(source) : source;
}
