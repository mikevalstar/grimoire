import type { Database } from "bun:sqlite";
import { resolveDatabase } from "./db.ts";
import type { Preferences } from "./schemas.ts";
import { PREF_KEYS } from "./types.ts";

/**
 * The flat key/value `preferences` table in grimoire.db; every value is stored
 * as text. Schema and file location live in `db.ts`.
 */
export class SettingsStore {
  private db: Database;

  constructor(source?: Database | string) {
    this.db = resolveDatabase(source);
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
