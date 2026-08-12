import type { Database } from "bun:sqlite";
import { resolveDatabase } from "./db.ts";
import type { CsBook } from "./schemas.ts";

/**
 * A book as the mirror holds it — Calibre's own payload, flattened. JSON-valued
 * columns arrive as strings; `BooksStore` is what turns them back into arrays.
 */
export interface CalibreBookRow {
  calibre_id: number;
  uuid: string;
  library_id: string;
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
  comments: string | null;
  pages: number | null;
  pubdate: string | null;
  timestamp: string | null;
  last_modified: string;
  has_cover: number;
  raw: string;
  synced_at: string;
}

/**
 * Just enough of a mirror row to answer the two questions a sweep asks about an
 * id it already holds: does it still mean the same book, and has that book
 * changed since we wrote it?
 */
export interface CalibreIdentity {
  calibre_id: number;
  uuid: string;
  last_modified: string;
}

/**
 * Calibre reports an unset date as the literal string "None" rather than null
 * or an empty string, which would otherwise be stored and rendered verbatim.
 */
function isoOrNull(value: string | null | undefined): string | null {
  if (!value || value === "None") return null;
  return value;
}

/**
 * The verbatim mirror of the connected Calibre library (ADR 0011). Nothing here
 * reconciles or interprets — that is `BooksStore`'s job. This store's contract
 * is narrow on purpose: what Calibre said, as Calibre said it.
 *
 * See docs/features/calibre-sync.md.
 */
export class CalibreBooksStore {
  private db: Database;

  constructor(source?: Database | string) {
    this.db = resolveDatabase(source);
  }

  count(): number {
    const row = this.db.query("SELECT COUNT(*) AS n FROM calibre_books").get() as { n: number };
    return row.n;
  }

  /** Every id the mirror holds, so a sweep can work out what has been deleted. */
  allIds(): number[] {
    const rows = this.db.query("SELECT calibre_id FROM calibre_books").all() as {
      calibre_id: number;
    }[];
    return rows.map((r) => r.calibre_id);
  }

  /**
   * The lowest N ids we hold, used as sentinels. An incremental sweep only
   * fetches books Calibre says have changed, so a swapped-in library whose
   * timestamps all sit below our watermark would never be examined. Asking
   * about a fixed handful of ids every tick closes that hole for the price of a
   * longer query string on a request we were making anyway.
   */
  sentinelIds(limit = 20): number[] {
    const rows = this.db
      .query("SELECT calibre_id FROM calibre_books ORDER BY calibre_id LIMIT $limit")
      .all({ $limit: limit }) as { calibre_id: number }[];
    return rows.map((r) => r.calibre_id);
  }

  /** What we currently believe each of these ids is, and when it last changed. */
  identities(ids: number[]): Map<number, CalibreIdentity> {
    if (ids.length === 0) return new Map();
    const rows = this.db
      .query(
        `SELECT calibre_id, uuid, last_modified FROM calibre_books
          WHERE calibre_id IN (${ids.map(() => "?").join(",")})`,
      )
      .all(...ids) as CalibreIdentity[];
    return new Map(rows.map((r) => [r.calibre_id, r]));
  }

  all(): CalibreBookRow[] {
    return this.db
      .query("SELECT * FROM calibre_books ORDER BY calibre_id")
      .all() as CalibreBookRow[];
  }

  /**
   * Write one book as Calibre described it. Conflicts are resolved on
   * `calibre_id` *and* on `uuid`: within one library only the id can collide,
   * but after a library switch an id we already hold may arrive carrying a uuid
   * that another row holds. Deleting the uuid's previous owner first keeps the
   * UNIQUE constraint honest without failing the sync.
   */
  upsert(calibreId: number, libraryId: string, book: CsBook, raw: unknown, now: string): void {
    this.db
      .query("DELETE FROM calibre_books WHERE uuid = $uuid AND calibre_id != $calibreId")
      .run({ $uuid: book.uuid, $calibreId: calibreId });

    this.db
      .query(
        `INSERT INTO calibre_books (
           calibre_id, uuid, library_id, title, title_sort, authors, author_sort,
           series, series_index, tags, formats, publisher, languages, identifiers,
           comments, pages, pubdate, timestamp, last_modified, has_cover, raw, synced_at
         ) VALUES (
           $calibreId, $uuid, $libraryId, $title, $titleSort, $authors, $authorSort,
           $series, $seriesIndex, $tags, $formats, $publisher, $languages, $identifiers,
           $comments, $pages, $pubdate, $timestamp, $lastModified, $hasCover, $raw, $syncedAt
         )
         ON CONFLICT (calibre_id) DO UPDATE SET
           uuid = excluded.uuid, library_id = excluded.library_id, title = excluded.title,
           title_sort = excluded.title_sort, authors = excluded.authors,
           author_sort = excluded.author_sort, series = excluded.series,
           series_index = excluded.series_index, tags = excluded.tags,
           formats = excluded.formats, publisher = excluded.publisher,
           languages = excluded.languages, identifiers = excluded.identifiers,
           comments = excluded.comments, pages = excluded.pages, pubdate = excluded.pubdate,
           timestamp = excluded.timestamp, last_modified = excluded.last_modified,
           has_cover = excluded.has_cover, raw = excluded.raw, synced_at = excluded.synced_at`,
      )
      .run({
        $calibreId: calibreId,
        $uuid: book.uuid,
        $libraryId: libraryId,
        $title: book.title,
        $titleSort: book.title_sort ?? null,
        $authors: JSON.stringify(book.authors ?? []),
        $authorSort: book.author_sort ?? null,
        $series: book.series ?? null,
        $seriesIndex: book.series_index ?? null,
        $tags: JSON.stringify(book.tags ?? []),
        $formats: JSON.stringify((book.formats ?? []).map((f) => f.toUpperCase())),
        $publisher: book.publisher ?? null,
        $languages: JSON.stringify(book.languages ?? []),
        $identifiers: JSON.stringify(book.identifiers ?? {}),
        $comments: book.comments ?? null,
        $pages: book.pages ?? null,
        $pubdate: isoOrNull(book.pubdate),
        $timestamp: isoOrNull(book.timestamp),
        // Falling back to `now` keeps the column NOT NULL for a Calibre old
        // enough to omit it; such a book simply re-syncs every tick.
        $lastModified: isoOrNull(book.last_modified) ?? now,
        $hasCover: book.cover ? 1 : 0,
        $raw: JSON.stringify(raw),
        $syncedAt: now,
      });
  }

  /** Drop the ids Calibre no longer reports. Chunked to stay under SQLite's variable limit. */
  deleteMissing(presentIds: number[]): number {
    const present = new Set(presentIds);
    const stale = this.allIds().filter((id) => !present.has(id));
    if (stale.length === 0) return 0;

    const stmt = this.db.query("DELETE FROM calibre_books WHERE calibre_id = ?");
    this.db.transaction((ids: number[]) => {
      for (const id of ids) stmt.run(id);
    })(stale);
    return stale.length;
  }

  /** Start over. Used when the id space turns out to belong to a different library. */
  clear(): void {
    this.db.run("DELETE FROM calibre_books");
  }

  close(): void {
    this.db.close();
  }
}
