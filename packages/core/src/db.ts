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
  // Off by default in SQLite, and the ratings table's ON DELETE CASCADE is
  // inert without it — removing a reader has to take their ratings with them.
  db.run("PRAGMA foreign_keys = ON");
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

  // A verbatim mirror of the Calibre content server (ADR 0011). Rows here come
  // and go with Calibre's own; this is a cache of the connected library, not a
  // history. Keyed by calibre_id because that is what the id sweep returns and
  // what deletion detection compares.
  //
  // `uuid` is the identity the reconcile matches on — Calibre's ids are small
  // sequential integers scoped to one library, so id 42 names a different book
  // in every library. UNIQUE because a duplicate would mean two Grimoire books
  // fighting over one mirror row.
  //
  // `library_id` is a *label*, never identity: Calibre derives it from the
  // library folder's basename, so two unrelated libraries both living in a
  // "Calibre Library" folder report the same one. Nothing may branch on it —
  // see docs/features/calibre-sync.md.
  db.run(`
    CREATE TABLE IF NOT EXISTS calibre_books (
      calibre_id      INTEGER PRIMARY KEY,
      uuid            TEXT NOT NULL UNIQUE,
      library_id      TEXT NOT NULL,
      title           TEXT NOT NULL,
      title_sort      TEXT,
      authors         TEXT NOT NULL DEFAULT '[]',
      author_sort     TEXT,
      series          TEXT,
      series_index    REAL,
      tags            TEXT NOT NULL DEFAULT '[]',
      formats         TEXT NOT NULL DEFAULT '[]',
      publisher       TEXT,
      languages       TEXT NOT NULL DEFAULT '[]',
      identifiers     TEXT NOT NULL DEFAULT '{}',
      comments        TEXT,
      pages           INTEGER,
      pubdate         TEXT,
      timestamp       TEXT,
      last_modified   TEXT NOT NULL,
      has_cover       INTEGER NOT NULL DEFAULT 1,
      raw             TEXT NOT NULL,
      synced_at       TEXT NOT NULL
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS calibre_books_last_modified ON calibre_books(last_modified)");
  db.run("CREATE INDEX IF NOT EXISTS calibre_books_uuid ON calibre_books(uuid)");

  // Grimoire's own book record — the table every screen reads (ADR 0011). One
  // row per book we know about, from any source, forever: sync inserts and
  // updates but never deletes, so nothing Grimoire owns is keyed to something
  // Calibre can revoke.
  //
  // The two Calibre columns do different jobs on purpose:
  //   calibre_uuid — identity. Set on insert, never cleared. UNIQUE, and
  //                  SQLite allows many NULLs, so a future non-Calibre source
  //                  needs no placeholder.
  //   calibre_id   — a cached pointer into whichever library is connected right
  //                  now, cleared when the book is absent from the mirror.
  //                  Deliberately not UNIQUE and carrying no foreign key: after
  //                  a library switch the same integer legitimately describes a
  //                  different book, and a full re-mirror has a window where
  //                  both owners exist. `calibre_id IS NOT NULL` is the exact
  //                  test for "in the library right now".
  db.run(`
    CREATE TABLE IF NOT EXISTS books (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      source          TEXT NOT NULL,
      calibre_uuid    TEXT UNIQUE,
      calibre_id      INTEGER,
      title           TEXT NOT NULL,
      title_sort      TEXT,
      authors         TEXT NOT NULL DEFAULT '[]',
      author_sort     TEXT,
      series          TEXT,
      series_index    REAL,
      tags            TEXT NOT NULL DEFAULT '[]',
      formats         TEXT NOT NULL DEFAULT '[]',
      publisher       TEXT,
      languages       TEXT NOT NULL DEFAULT '[]',
      identifiers     TEXT NOT NULL DEFAULT '{}',
      description     TEXT,
      pages           INTEGER,
      published       TEXT,
      added           TEXT NOT NULL,
      cover_state     TEXT NOT NULL DEFAULT 'none',
      cover_synced_at TEXT,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS books_title_sort ON books(title_sort)");
  db.run("CREATE INDEX IF NOT EXISTS books_source ON books(source)");
  db.run("CREATE INDEX IF NOT EXISTS books_calibre_id ON books(calibre_id)");

  // A reader's own stars (ADR 0006 — Grimoire-only data, never written back to
  // Calibre). Unrated is the absence of a row, not a zero, so "cleared" and
  // "never rated" stay the same thing. See docs/features/rating-a-book.md.
  //
  // book_id means books.id. It used to mean a *Calibre* id, and rather than map
  // the old rows onto new ones — which could not be done at migration time,
  // since `books` is empty until the first sync — the table is dropped and
  // rebuilt (ADR 0011). Ratings set before this version are discarded.
  if (ratingsAreKeyedByCalibreId(db)) {
    db.run("DROP TABLE ratings");
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS ratings (
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, book_id)
    )
  `);
}

/**
 * True for a pre-ADR-0011 `ratings` table, whose `book_id` held a Calibre id and
 * referenced nothing. Detected from the schema rather than a version counter so
 * the check is idempotent: once the table references `books`, this is false and
 * the drop never runs again.
 */
function ratingsAreKeyedByCalibreId(db: Database): boolean {
  const row = db
    .query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'ratings'")
    .get() as { sql: string } | null;
  return row !== null && !row.sql.includes("REFERENCES books");
}

/** Accept either an open connection or a path, so stores can share one db. */
export function resolveDatabase(source: Database | string = defaultDatabasePath()): Database {
  return typeof source === "string" ? openDatabase(source) : source;
}
