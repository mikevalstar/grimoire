import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { matchKey } from "./matching.ts";
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
  //
  // The hardcover_* pair is a *credential*, held per reader rather than per
  // instance because a Hardcover token is a person — everything behind it is
  // theirs, and writes we make later happen as them (ADR 0012). Both columns
  // move together: a token is only ever stored alongside the username the probe
  // that accepted it returned, so `hardcover_username IS NOT NULL` is the exact
  // test for "linked". hardcover_token must never reach the browser — see
  // UsersStore, which leaves it out of every row it returns.
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      name               TEXT NOT NULL COLLATE NOCASE UNIQUE,
      color              TEXT NOT NULL,
      created_at         TEXT NOT NULL,
      hardcover_token    TEXT,
      hardcover_username TEXT,
      hardcover_user_id  INTEGER,
      hardcover_synced_at TEXT,
      hardcover_sync_error TEXT
    )
  `);
  addColumn(db, "users", "hardcover_token", "TEXT");
  addColumn(db, "users", "hardcover_username", "TEXT");
  // Their numeric id, which is what asking for their library takes; and the
  // state of their last sync, kept per reader because each one has their own
  // account, own rate limit and own way to fail (docs/features/hardcover-sync.md).
  addColumn(db, "users", "hardcover_user_id", "INTEGER");
  addColumn(db, "users", "hardcover_synced_at", "TEXT");
  addColumn(db, "users", "hardcover_sync_error", "TEXT");
  // Where this reader's stars live — 'local' or 'hardcover' (ADR 0014). The
  // first per-reader preference; a column rather than a preferences row because
  // the API needs it on every rating write.
  addColumn(db, "users", "ratings_source", "TEXT NOT NULL DEFAULT 'local'");
  // Same choice for read state (docs/features/marking-a-book-read.md).
  // Defaulted to hardcover — unlike ratings there was no local store to stay
  // loyal to — but it only takes effect for a linked reader; everyone else is
  // local regardless.
  addColumn(db, "users", "read_state_source", "TEXT NOT NULL DEFAULT 'hardcover'");

  // A verbatim mirror of hardcover.app, split the way the Calibre mirror is:
  // what they said, kept apart from what Grimoire decided to keep.
  //
  // Keyed by Hardcover's book id, which — unlike Calibre's — is global rather
  // than scoped to one library, so it identifies on its own. Shared across
  // readers: two people who shelved the same book get one row here.
  db.run(`
    CREATE TABLE IF NOT EXISTS hardcover_books (
      hardcover_id INTEGER PRIMARY KEY,
      title        TEXT NOT NULL,
      subtitle     TEXT,
      authors      TEXT NOT NULL DEFAULT '[]',
      description  TEXT,
      pages        INTEGER,
      release_date TEXT,
      slug         TEXT,
      tags         TEXT NOT NULL DEFAULT '[]',
      cover_url    TEXT,
      raw          TEXT NOT NULL,
      synced_at    TEXT NOT NULL
    )
  `);

  // One reader's relationship with one book: status, their rating, the dates.
  // Rows here *are* deleted when a book leaves someone's shelves — this mirrors
  // their library as it is now, where `books` is a permanent record.
  //
  // Keyed by (reader, book) rather than by Hardcover's user_books.id: the sweep
  // asks for one entry per book, and "this reader's take on this book" is what
  // every later feature looks up.
  db.run(`
    CREATE TABLE IF NOT EXISTS hardcover_user_books (
      user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      hardcover_book_id INTEGER NOT NULL,
      user_book_id      INTEGER NOT NULL,
      status_id         INTEGER NOT NULL,
      rating            REAL,
      owned             INTEGER NOT NULL DEFAULT 0,
      read_count        INTEGER,
      date_added        TEXT,
      first_read_date   TEXT,
      last_read_date    TEXT,
      updated_at        TEXT,
      raw               TEXT NOT NULL,
      synced_at         TEXT NOT NULL,
      PRIMARY KEY (user_id, hardcover_book_id)
    )
  `);
  db.run(
    "CREATE INDEX IF NOT EXISTS hardcover_user_books_book ON hardcover_user_books(hardcover_book_id)",
  );

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
      updated_at      TEXT NOT NULL,
      hardcover_id    INTEGER UNIQUE,
      cover_url       TEXT
    )
  `);
  // Shaped like calibre_uuid rather than calibre_id: Hardcover's book ids are
  // global, so this identifies and is never cleared. `cover_url` is for books
  // whose cover Grimoire holds no file for — Hardcover serves its own and there
  // is no scaler on that path (docs/features/hardcover-sync.md).
  addColumn(db, "books", "hardcover_id", "INTEGER");
  addColumn(db, "books", "cover_url", "TEXT");
  // SQLite cannot add a UNIQUE column by ALTER, so the constraint is an index —
  // which is what the inline UNIQUE above creates anyway.
  db.run("CREATE UNIQUE INDEX IF NOT EXISTS books_hardcover_id ON books(hardcover_id)");
  // A book that exists in two sources is two rows and one work (ADR 0013). The
  // row carries nothing but an id: its entire meaning is "these book rows are
  // the same book". Grouping is only ever an UPDATE of books.work_id, so a book
  // can never be in two works or none.
  db.run(`
    CREATE TABLE IF NOT EXISTS works (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL
    )
  `);

  // Which member's cover to show for a work whose members brought more than one
  // (docs/features/book-details-panel.md). Null means "nobody has chosen", and
  // the rule picks — so this holds *decisions*, and a work reverts to the rule
  // if the chosen member ever loses its cover. Not per reader: a cover is what
  // the book looks like, not what someone thinks of it.
  addColumn(db, "works", "cover_book_id", "INTEGER REFERENCES books(id)");

  // Nullable in SQL only because ALTER cannot add a NOT NULL column to a table
  // that already has rows; every path that inserts a book gives it a work, and
  // the backfill below gives one to every row written before this existed.
  addColumn(db, "books", "work_id", "INTEGER REFERENCES works(id)");
  // The normalised title the matcher groups on, written by the same function on
  // both reconcile paths (docs/features/book-matching.md).
  addColumn(db, "books", "match_key", "TEXT");
  // A grouping a human decided. The matcher skips these rows entirely, so a
  // manual fix survives every later sync. Nothing writes it yet.
  addColumn(db, "books", "work_pinned", "INTEGER NOT NULL DEFAULT 0");
  db.run("CREATE INDEX IF NOT EXISTS books_work_id ON books(work_id)");
  db.run("CREATE INDEX IF NOT EXISTS books_match_key ON books(match_key)");

  // "These two rows are not the same book" — a person's answer to a suggestion
  // (docs/features/resolving-duplicates.md). The negative edge ADR 0013
  // anticipated: without it the answer would last until the next sync, since
  // the matcher would re-group the pair on the same evidence that raised it.
  //
  // Between *rows* rather than works, because a row is the stable thing — a
  // work is exactly the grouping being argued about. Stored with the lower id
  // first so the fact is one row and no lookup has to try it both ways.
  db.run(`
    CREATE TABLE IF NOT EXISTS book_not_duplicates (
      book_id       INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      other_book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      created_at    TEXT NOT NULL,
      PRIMARY KEY (book_id, other_book_id),
      CHECK (book_id < other_book_id)
    )
  `);

  backfillWorks(db);
  backfillMatchKeys(db);

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
  // Keyed by books.id (ADR 0011) rather than works.id (ADR 0013): set aside,
  // so the table below can be created and the rows copied across into it.
  if (ratingsTableReferences(db, "books")) {
    db.run("ALTER TABLE ratings RENAME TO ratings_by_book");
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS ratings (
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      work_id    INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
      rating     REAL NOT NULL CHECK (rating BETWEEN 0.5 AND 5 AND rating * 2 = CAST(rating * 2 AS INTEGER)),
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, work_id)
    )
  `);
  rekeyRatingsOntoWorks(db);
  widenRatingsToHalves(db);

  // A reader's local read state (docs/features/marking-a-book-read.md) —
  // shaped like ratings: keyed by work, unread is the absence of a row.
  // `finished_at` holds the reader's answer at its own precision — "2023",
  // "2023-06", "2023-06-15" — or NULL for read-but-don't-know-when.
  db.run(`
    CREATE TABLE IF NOT EXISTS read_states (
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      work_id     INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
      finished_at TEXT,
      updated_at  TEXT NOT NULL,
      PRIMARY KEY (user_id, work_id)
    )
  `);
}

/**
 * Ratings were whole stars in an INTEGER column; Hardcover rates in halves and
 * local ratings adopted the same unit (ADR 0014). SQLite can't retype a column,
 * so a table that predates this is rebuilt — every whole star is already a
 * valid half, so the rows copy as they are.
 */
function widenRatingsToHalves(db: Database): void {
  const columns = db.query("PRAGMA table_info(ratings)").all() as {
    name: string;
    type: string;
  }[];
  if (columns.find((column) => column.name === "rating")?.type !== "INTEGER") return;

  db.transaction(() => {
    db.run("ALTER TABLE ratings RENAME TO ratings_whole");
    db.run(`
      CREATE TABLE ratings (
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        work_id    INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
        rating     REAL NOT NULL CHECK (rating BETWEEN 0.5 AND 5 AND rating * 2 = CAST(rating * 2 AS INTEGER)),
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, work_id)
      )
    `);
    db.run("INSERT INTO ratings SELECT * FROM ratings_whole");
    db.run("DROP TABLE ratings_whole");
  })();
}

/**
 * Give every book a work of its own. Runs once per book, ever: after this,
 * inserts create their own and the matcher only ever moves books between works.
 *
 * Row by row rather than one INSERT…SELECT, because the point is the *mapping*
 * — which new work belongs to which book — and SQLite will not hand that back
 * from a bulk insert.
 */
function backfillWorks(db: Database): void {
  const orphans = db.query("SELECT id FROM books WHERE work_id IS NULL").all() as { id: number }[];
  if (orphans.length === 0) return;

  const now = new Date().toISOString();
  const createWork = db.query("INSERT INTO works (created_at) VALUES ($now) RETURNING id");
  const assign = db.query("UPDATE books SET work_id = $workId WHERE id = $id");

  db.transaction(() => {
    for (const book of orphans) {
      const work = createWork.get({ $now: now }) as { id: number };
      assign.run({ $workId: work.id, $id: book.id });
    }
  })();
}

/**
 * Give every book already here a match key. Sync writes one for every row it
 * reconciles, but a library that was already settled when this arrived would
 * otherwise sit there with nothing to match on until each book happened to
 * change (docs/features/book-matching.md).
 *
 * Rows whose title normalises to nothing keep a NULL key and are re-examined on
 * every open, which is a handful of untitled books and a query that returns
 * almost nothing — cheaper than a column to remember we already tried.
 */
function backfillMatchKeys(db: Database): void {
  const rows = db.query("SELECT id, title FROM books WHERE match_key IS NULL").all() as {
    id: number;
    title: string;
  }[];
  if (rows.length === 0) return;

  const set = db.query("UPDATE books SET match_key = $key WHERE id = $id");
  db.transaction(() => {
    for (const book of rows) {
      const key = matchKey(book.title);
      if (key) set.run({ $key: key, $id: book.id });
    }
  })();
}

/**
 * Move ratings from `books.id` to `works.id` (ADR 0013).
 *
 * Unlike the ADR 0011 re-key, which had to discard ratings because `books` was
 * empty at migration time, this one loses nothing: every book already has a
 * work by the time this runs, so each rating has exactly one place to go. Two
 * rows for one work — a reader who rated both halves of a book before it was
 * grouped — keep the higher rating, since the alternative is picking by row
 * order, which is picking at random.
 */
function rekeyRatingsOntoWorks(db: Database): void {
  const legacy = db
    .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ratings_by_book'")
    .get();
  if (!legacy) return;

  db.transaction(() => {
    db.run(
      `INSERT INTO ratings (user_id, work_id, rating, updated_at)
         SELECT r.user_id, b.work_id, MAX(r.rating), MAX(r.updated_at)
           FROM ratings_by_book r
           JOIN books b ON b.id = r.book_id
          WHERE b.work_id IS NOT NULL
          GROUP BY r.user_id, b.work_id
       ON CONFLICT (user_id, work_id) DO NOTHING`,
    );
    db.run("DROP TABLE ratings_by_book");
  })();
}

/**
 * Add a column to a table that already exists, for databases created before it
 * did. New databases get it from the CREATE above, so the two must agree — this
 * is the catch-up path, not the definition.
 *
 * Table and column are interpolated because SQLite takes neither as a bound
 * parameter; every caller is a literal in this file.
 */
function addColumn(db: Database, table: string, column: string, definition: string): void {
  const columns = db.query(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (columns.some((existing) => existing.name === column)) return;
  db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

/** Whether the `ratings` table as it stands points at the given table. */
function ratingsTableReferences(db: Database, table: string): boolean {
  const row = db
    .query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'ratings'")
    .get() as { sql: string } | null;
  return row?.sql.includes(`REFERENCES ${table}`) ?? false;
}

/**
 * True for a pre-ADR-0011 `ratings` table, whose `book_id` held a Calibre id and
 * referenced nothing at all. Detected from the schema rather than a version
 * counter so the check is idempotent — and it has to name *both* later shapes,
 * or the work-keyed table this migration creates would look like the ancient one
 * and be dropped on the next open.
 */
function ratingsAreKeyedByCalibreId(db: Database): boolean {
  const row = db
    .query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'ratings'")
    .get() as { sql: string } | null;
  return (
    row !== null && !row.sql.includes("REFERENCES books") && !row.sql.includes("REFERENCES works")
  );
}

/** Accept either an open connection or a path, so stores can share one db. */
export function resolveDatabase(source: Database | string = defaultDatabasePath()): Database {
  return typeof source === "string" ? openDatabase(source) : source;
}
