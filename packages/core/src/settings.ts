import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { Preferences } from "./schemas.ts";
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
 * Grimoire's own SQLite database. For now it holds nothing but a flat
 * key/value `preferences` table; every value is stored as text.
 */
export class SettingsStore {
  readonly path: string;
  private db: Database;

  constructor(path: string = defaultDatabasePath()) {
    this.path = path;
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true });
    }
    this.db = new Database(path, { create: true });
    this.db.run("PRAGMA journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
    // Version 0 means "never configured" — the UI takes that as its cue to run
    // first-time setup.
    this.db
      .query("INSERT OR IGNORE INTO preferences (key, value) VALUES ($key, $value)")
      .run({ $key: PREF_KEYS.version, $value: "0" });
  }

  get(key: string): string | null {
    const row = this.db
      .query("SELECT value FROM preferences WHERE key = $key")
      .get({ $key: key }) as { value: string } | null;
    return row?.value ?? null;
  }

  all(): Preferences {
    const rows = this.db.query("SELECT key, value FROM preferences").all() as {
      key: string;
      value: string;
    }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  set(key: string, value: string): void {
    this.setMany({ [key]: value });
  }

  setMany(entries: Preferences): void {
    const stmt = this.db.query(
      "INSERT INTO preferences (key, value) VALUES ($key, $value) " +
        "ON CONFLICT (key) DO UPDATE SET value = excluded.value",
    );
    this.db.transaction((prefs: Preferences) => {
      for (const [key, value] of Object.entries(prefs)) {
        stmt.run({ $key: key, $value: value });
      }
    })(entries);
  }

  delete(key: string): void {
    this.db.query("DELETE FROM preferences WHERE key = $key").run({ $key: key });
  }

  /** The preferences schema version, or 0 if it was never set. */
  version(): number {
    return Number(this.get(PREF_KEYS.version) ?? 0) || 0;
  }

  close(): void {
    this.db.close();
  }
}
