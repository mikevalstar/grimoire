import type { Database } from "bun:sqlite";
import type { CalibreBookRow } from "./calibre-books.ts";
import { resolveDatabase } from "./db.ts";
import type { Book } from "./schemas.ts";
import { BOOK_SOURCE } from "./types.ts";

interface BookRow {
  id: number;
  source: string;
  calibre_uuid: string | null;
  calibre_id: number | null;
  title: string;
  title_sort: string | null;
  authors: string;
  author_sort: string | null;
  series: string | null;
  series_index: number | null;
  tags: string;
  formats: string;
  publisher: string | null;
  languages: string;
  identifiers: string;
  description: string | null;
  pages: number | null;
  published: string | null;
  added: string;
  cover_state: string;
  cover_synced_at: string | null;
}

/** What a reconcile did, for the sync log and the progress readout. */
export interface ReconcileResult {
  inserted: number;
  updated: number;
  /** Books that left the connected library and had their `calibre_id` cleared. */
  unlinked: number;
}

/** A book needing its covers fetched, and the id to fetch them from Calibre with. */
export interface CoverTarget {
  id: number;
  calibreId: number;
  lastModified: string;
}

function parseArray(json: string): string[] {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function parseRecord(json: string): Record<string, string> {
  try {
    const value = JSON.parse(json);
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function toBook(row: BookRow): Book {
  return {
    id: row.id,
    source: row.source,
    calibreId: row.calibre_id,
    title: row.title,
    authors: parseArray(row.authors),
    series: row.series,
    seriesIndex: row.series_index,
    tags: parseArray(row.tags),
    formats: parseArray(row.formats),
    publisher: row.publisher,
    languages: parseArray(row.languages),
    identifiers: parseRecord(row.identifiers),
    description: row.description,
    pages: row.pages,
    published: row.published,
    added: row.added,
    coverState:
      row.cover_state === "cached" || row.cover_state === "missing" ? row.cover_state : "none",
  };
}

/**
 * Grimoire's own book records — the table every library screen reads (ADR 0011).
 *
 * The reconcile below is the heart of the sync. Two rules it will not bend:
 * books are matched by Calibre's **uuid** and never by its book id, and a sync
 * **never deletes a book**. See docs/features/calibre-sync.md.
 */
export class BooksStore {
  private db: Database;

  constructor(source?: Database | string) {
    this.db = resolveDatabase(source);
  }

  list(): Book[] {
    const rows = this.db
      .query("SELECT * FROM books ORDER BY title_sort IS NULL, title_sort, title")
      .all() as BookRow[];
    return rows.map(toBook);
  }

  get(id: number): Book | null {
    const row = this.db
      .query("SELECT * FROM books WHERE id = $id")
      .get({ $id: id }) as BookRow | null;
    return row ? toBook(row) : null;
  }

  count(): number {
    const row = this.db.query("SELECT COUNT(*) AS n FROM books").get() as { n: number };
    return row.n;
  }

  /** How many are still in the connected Calibre library. */
  inLibraryCount(): number {
    const row = this.db
      .query("SELECT COUNT(*) AS n FROM books WHERE calibre_id IS NOT NULL")
      .get() as { n: number };
    return row.n;
  }

  /**
   * Fold the whole mirror into `books`, matching on `calibre_uuid`.
   *
   * Runs in one transaction: a reconcile that half-applied would leave books
   * pointing at ids from two different libraries, which is the exact state this
   * design exists to prevent.
   */
  reconcileFromCalibre(mirror: CalibreBookRow[], now: string): ReconcileResult {
    const result: ReconcileResult = { inserted: 0, updated: 0, unlinked: 0 };

    const existing = this.db
      .query("SELECT id, calibre_uuid FROM books WHERE calibre_uuid IS NOT NULL")
      .all() as {
      id: number;
      calibre_uuid: string;
    }[];
    const byUuid = new Map(existing.map((r) => [r.calibre_uuid, r.id]));

    const insert = this.db.query(
      `INSERT INTO books (
         source, calibre_uuid, calibre_id, title, title_sort, authors, author_sort,
         series, series_index, tags, formats, publisher, languages, identifiers,
         description, pages, published, added, created_at, updated_at
       ) VALUES (
         $source, $calibreUuid, $calibreId, $title, $titleSort, $authors, $authorSort,
         $series, $seriesIndex, $tags, $formats, $publisher, $languages, $identifiers,
         $description, $pages, $published, $added, $now, $now
       )`,
    );

    // calibre_uuid is absent here on purpose: it is identity, set once on
    // insert and never rewritten. Everything else, including calibre_id, is
    // Calibre's to change.
    const update = this.db.query(
      `UPDATE books SET
         calibre_id = $calibreId, title = $title, title_sort = $titleSort,
         authors = $authors, author_sort = $authorSort, series = $series,
         series_index = $seriesIndex, tags = $tags, formats = $formats,
         publisher = $publisher, languages = $languages, identifiers = $identifiers,
         description = $description, pages = $pages, published = $published,
         updated_at = $now
       WHERE id = $id`,
    );

    const run = this.db.transaction((rows: CalibreBookRow[]) => {
      // Clear the pointer on every book first, then let the loop below re-set it
      // for those still present. Doing it in this order means an id that moved
      // to a different book within one pass can never be held by two rows at
      // once, even briefly.
      const seenUuids = new Set(rows.map((r) => r.uuid));
      const linked = this.db
        .query("SELECT id, calibre_uuid FROM books WHERE calibre_id IS NOT NULL")
        .all() as { id: number; calibre_uuid: string | null }[];
      for (const book of linked) {
        if (!book.calibre_uuid || !seenUuids.has(book.calibre_uuid)) result.unlinked++;
      }
      this.db.run("UPDATE books SET calibre_id = NULL WHERE calibre_id IS NOT NULL");

      for (const row of rows) {
        const shared = {
          $calibreId: row.calibre_id,
          $title: row.title,
          $titleSort: row.title_sort,
          $authors: row.authors,
          $authorSort: row.author_sort,
          $series: row.series,
          $seriesIndex: row.series_index,
          $tags: row.tags,
          $formats: row.formats,
          $publisher: row.publisher,
          $languages: row.languages,
          $identifiers: row.identifiers,
          $description: row.comments,
          $pages: row.pages,
          $published: row.pubdate,
          $now: now,
        };

        const id = byUuid.get(row.uuid);
        if (id === undefined) {
          insert.run({
            ...shared,
            $source: BOOK_SOURCE.calibre,
            $calibreUuid: row.uuid,
            $added: row.timestamp ?? now,
          });
          result.inserted++;
        } else {
          update.run({ ...shared, $id: id });
          result.updated++;
        }
      }
    });

    run(mirror);
    return result;
  }

  /**
   * Books whose cached covers are older than the book itself, newest first so a
   * first sync fills in what the user is most likely looking at.
   *
   * Comparing against `last_modified` is coarse — editing a title refetches
   * three images — but a stale cover is worse than a wasted request, and
   * Calibre exposes no cover-specific mtime.
   */
  coversToFetch(): CoverTarget[] {
    const rows = this.db
      .query(
        `SELECT b.id AS id, b.calibre_id AS calibreId, c.last_modified AS lastModified
           FROM books b
           JOIN calibre_books c ON c.calibre_id = b.calibre_id
          WHERE b.calibre_id IS NOT NULL
            AND c.has_cover = 1
            AND (b.cover_synced_at IS NULL OR b.cover_synced_at < c.last_modified)
          ORDER BY c.last_modified DESC`,
      )
      .all() as CoverTarget[];
    return rows;
  }

  /**
   * Books the database believes have cached covers, for checking that claim
   * against the filesystem. Only those still in Calibre, since a book that has
   * left cannot have its cover fetched again anyway.
   */
  cachedCoverTargets(): CoverTarget[] {
    return this.db
      .query(
        `SELECT b.id AS id, b.calibre_id AS calibreId, c.last_modified AS lastModified
           FROM books b
           JOIN calibre_books c ON c.calibre_id = b.calibre_id
          WHERE b.cover_state = 'cached' AND b.calibre_id IS NOT NULL`,
      )
      .all() as CoverTarget[];
  }

  markCover(id: number, state: "cached" | "missing", syncedAt: string | null): void {
    this.db
      .query("UPDATE books SET cover_state = $state, cover_synced_at = $syncedAt WHERE id = $id")
      .run({ $id: id, $state: state, $syncedAt: syncedAt });
  }

  close(): void {
    this.db.close();
  }
}
