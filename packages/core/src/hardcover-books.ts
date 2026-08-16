import type { Database } from "bun:sqlite";
import { resolveDatabase } from "./db.ts";
import type { HardcoverRatings, HcBookSeries, HcUserBook } from "./schemas.ts";

/** One work's line in {@link HardcoverBooksStore.ratingsByWork}. */
type HardcoverShelfEntry = HardcoverRatings[string];

/**
 * A book as the Hardcover mirror holds it — their payload, flattened. JSON
 * columns arrive as strings; `BooksStore` turns them back into arrays.
 */
export interface HardcoverBookRow {
  hardcover_id: number;
  title: string;
  subtitle: string | null;
  authors: string;
  description: string | null;
  pages: number | null;
  release_date: string | null;
  slug: string | null;
  tags: string;
  /** JSON array of `MirroredSeries` — their `book_series`, flattened. */
  series: string;
  cover_url: string | null;
  raw: string;
  synced_at: string;
}

/** One reader's shelf entry, as stored. */
export interface HardcoverUserBookRow {
  user_id: number;
  hardcover_book_id: number;
  user_book_id: number;
  status_id: number;
  rating: number | null;
  owned: number;
  read_count: number | null;
  date_added: string | null;
  first_read_date: string | null;
  last_read_date: string | null;
  updated_at: string | null;
}

/** How many books a reader has at each Hardcover status. */
export interface HardcoverStatusCount {
  statusId: number;
  count: number;
}

/**
 * Their `cached_*` columns are JSON blobs with no documented shape, so every
 * reader below returns nothing rather than throwing: a field we guessed wrong
 * about must cost one book its tags, never a whole sync.
 */
function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Author names out of `cached_contributors`, which has been seen both as a list
 * of contributions (`{ author: { name } }`) and as a list of people (`{ name }`).
 * Both are read, anything else yields nothing.
 */
export function hardcoverAuthors(cached: unknown): string[] {
  const value = parseJson(cached);
  if (!Array.isArray(value)) return [];

  const names = value.flatMap((entry) => {
    if (typeof entry === "string") return [entry];
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const author = record.author as Record<string, unknown> | undefined;
    const name = author?.name ?? record.name;
    return typeof name === "string" && name.trim() ? [name.trim()] : [];
  });

  // A book with two contributions by the same person is common enough (author
  // and narrator) that deduping here is worth the line.
  return [...new Set(names)];
}

/**
 * One series a book is in, as the mirror stores it (ADR 0019). Flattened from
 * their `book_series` join so reconcile reads one shape, whether the entry came
 * from a shelf sweep — which can only afford the series *id*, their queries
 * stopping at depth 3 — or from a `books` query that could nest the series
 * itself. An entry the hydrate never named keeps a null `name`, and reconcile
 * skips it rather than inventing one.
 */
export interface MirroredSeries {
  seriesId: number;
  name: string | null;
  slug: string | null;
  booksCount: number | null;
  position: number | null;
  featured: boolean;
}

/**
 * Their `book_series` entries, flattened and deduped.
 *
 * **A series with a `canonical_id` is a duplicate of that one**, per their own
 * librarians, so the canonical id is what gets stored — otherwise a merge on
 * their side would leave two Discworlds here, and the roster of one of them
 * would come back nearly empty. The name still comes from the row we were
 * given: it is the only one we have, and `upsert` corrects it the moment the
 * canonical series is seen properly.
 */
export function hardcoverSeries(
  entries: readonly HcBookSeries[] | null | undefined,
): MirroredSeries[] {
  if (!entries) return [];

  const byId = new Map<number, MirroredSeries>();
  for (const entry of entries) {
    const series = entry.series;
    const id = series?.canonical_id ?? series?.id ?? entry.series_id;
    if (typeof id !== "number") continue;

    const mirrored: MirroredSeries = {
      seriesId: id,
      name: series?.name?.trim() || null,
      slug: series?.slug ?? null,
      booksCount: series?.books_count ?? null,
      position: entry.position ?? null,
      featured: entry.featured === true,
    };
    // Two rows collapsing onto one canonical series keep the featured one, and
    // a position over none — the same "an answer beats no answer" the resolver
    // applies a layer up.
    const existing = byId.get(id);
    if (!existing) byId.set(id, mirrored);
    else {
      if (!existing.featured && mirrored.featured) existing.featured = true;
      if (existing.position === null) existing.position = mirrored.position;
      if (!existing.name) existing.name = mirrored.name;
    }
  }
  return [...byId.values()];
}

/** Tag names out of `cached_tags`, which groups them by category. */
export function hardcoverTags(cached: unknown): string[] {
  const value = parseJson(cached);
  if (!value || typeof value !== "object") return [];

  // Either { Genre: [{ tag: "Fantasy" }], … } or a flat array of the same.
  const groups = Array.isArray(value) ? [value] : Object.values(value);
  const names = groups.flatMap((group) => {
    if (!Array.isArray(group)) return [];
    return group.flatMap((entry) => {
      if (typeof entry === "string") return [entry];
      if (!entry || typeof entry !== "object") return [];
      const tag = (entry as Record<string, unknown>).tag;
      return typeof tag === "string" && tag.trim() ? [tag.trim()] : [];
    });
  });
  return [...new Set(names)];
}

/**
 * The same names, kept under the categories Hardcover files them by — "Genre",
 * "Tag", "Mood", "Content Warning". The details panel shows genres and tags as
 * tags and moods on their own (docs/features/book-details-panel.md), which the
 * flattened list above cannot tell apart. A flat array — the other shape their
 * blob has been seen in — has no categories to report, so it yields nothing
 * rather than a made-up one.
 */
export function hardcoverTagsByCategory(cached: unknown): Record<string, string[]> {
  const value = parseJson(cached);
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const byCategory: Record<string, string[]> = {};
  for (const [category, group] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(group)) continue;
    const names = group.flatMap((entry) => {
      if (typeof entry === "string") return [entry];
      if (!entry || typeof entry !== "object") return [];
      const tag = (entry as Record<string, unknown>).tag;
      return typeof tag === "string" && tag.trim() ? [tag.trim()] : [];
    });
    if (names.length > 0) byCategory[category] = [...new Set(names)];
  }
  return byCategory;
}

/** The cover URL out of `cached_image`, which is `{ url, width, height, color }`. */
export function hardcoverCoverUrl(cached: unknown): string | null {
  const value = parseJson(cached);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const url = (value as Record<string, unknown>).url;
  return typeof url === "string" && url.startsWith("http") ? url : null;
}

/**
 * A rating as a number, or null. Their `rating` is a Postgres `numeric`, which
 * the gateway may render as a string — taking both keeps a serialisation detail
 * from putting `"4.5"` in a REAL column.
 */
function hardcoverRating(value: number | string | null | undefined): number | null {
  const rating = typeof value === "string" ? Number(value) : value;
  return typeof rating === "number" && Number.isFinite(rating) ? rating : null;
}

/**
 * A mirrored book's page on hardcover.app. Their public URLs are keyed by the
 * slug, never the numeric id, which is why `hardcover_books.slug` is mirrored
 * at all (docs/features/hardcover-sync.md). No slug, no link.
 */
export function hardcoverBookUrl(slug: string | null | undefined): string | null {
  const trimmed = slug?.trim();
  return trimmed ? `https://hardcover.app/books/${encodeURIComponent(trimmed)}` : null;
}

/**
 * The verbatim mirror of a reader's hardcover.app library
 * (docs/features/hardcover-sync.md). Nothing here reconciles or interprets —
 * that is `BooksStore`'s job.
 */
export class HardcoverBooksStore {
  private db: Database;

  constructor(source?: Database | string) {
    this.db = resolveDatabase(source);
  }

  /** Every mirrored book, for the reconcile. Shared by all readers. */
  allBooks(): HardcoverBookRow[] {
    return this.db
      .query("SELECT * FROM hardcover_books ORDER BY hardcover_id")
      .all() as HardcoverBookRow[];
  }

  bookCount(userId: number): number {
    const row = this.db
      .query("SELECT COUNT(*) AS n FROM hardcover_user_books WHERE user_id = $userId")
      .get({ $userId: userId }) as { n: number };
    return row.n;
  }

  /** What this reader has at each status — what settings shows under their name. */
  statusCounts(userId: number): HardcoverStatusCount[] {
    return this.db
      .query(
        `SELECT status_id AS statusId, COUNT(*) AS count
           FROM hardcover_user_books WHERE user_id = $userId
          GROUP BY status_id ORDER BY status_id`,
      )
      .all({ $userId: userId }) as HardcoverStatusCount[];
  }

  /**
   * Write one shelf entry: the book (shared) and the reader's take on it.
   * One transaction, so a book can never be mirrored without the entry that
   * explains why it is there.
   */
  upsert(userId: number, entry: HcUserBook, now: string): void {
    const book = entry.book;
    const write = this.db.transaction(() => {
      this.db
        .query(
          `INSERT INTO hardcover_books (
             hardcover_id, title, subtitle, authors, description, pages,
             release_date, slug, tags, series, cover_url, raw, synced_at
           ) VALUES (
             $id, $title, $subtitle, $authors, $description, $pages,
             $releaseDate, $slug, $tags, $series, $coverUrl, $raw, $now
           )
           ON CONFLICT (hardcover_id) DO UPDATE SET
             title = excluded.title, subtitle = excluded.subtitle,
             authors = excluded.authors, description = excluded.description,
             pages = excluded.pages, release_date = excluded.release_date,
             slug = excluded.slug, tags = excluded.tags, series = excluded.series,
             cover_url = excluded.cover_url, raw = excluded.raw,
             synced_at = excluded.synced_at`,
        )
        .run({
          $id: book.id,
          $title: book.title ?? "Untitled",
          $subtitle: book.subtitle ?? null,
          $authors: JSON.stringify(hardcoverAuthors(book.cached_contributors)),
          $description: book.description ?? null,
          $pages: book.pages ?? null,
          $releaseDate: book.release_date ?? null,
          $slug: book.slug ?? null,
          $tags: JSON.stringify(hardcoverTags(book.cached_tags)),
          $series: JSON.stringify(hardcoverSeries(book.book_series)),
          $coverUrl: hardcoverCoverUrl(book.cached_image),
          $raw: JSON.stringify(book),
          $now: now,
        });

      this.db
        .query(
          `INSERT INTO hardcover_user_books (
             user_id, hardcover_book_id, user_book_id, status_id, rating, owned,
             read_count, date_added, first_read_date, last_read_date, updated_at,
             raw, synced_at
           ) VALUES (
             $userId, $bookId, $userBookId, $statusId, $rating, $owned,
             $readCount, $dateAdded, $firstRead, $lastRead, $updatedAt,
             $raw, $now
           )
           ON CONFLICT (user_id, hardcover_book_id) DO UPDATE SET
             user_book_id = excluded.user_book_id, status_id = excluded.status_id,
             rating = excluded.rating, owned = excluded.owned,
             read_count = excluded.read_count, date_added = excluded.date_added,
             first_read_date = excluded.first_read_date,
             last_read_date = excluded.last_read_date,
             updated_at = excluded.updated_at, raw = excluded.raw,
             synced_at = excluded.synced_at`,
        )
        .run({
          $userId: userId,
          $bookId: book.id,
          $userBookId: entry.id,
          $statusId: entry.status_id,
          $rating: hardcoverRating(entry.rating),
          $owned: entry.owned ? 1 : 0,
          $readCount: entry.read_count ?? null,
          $dateAdded: entry.date_added ?? null,
          $firstRead: entry.first_read_date ?? null,
          $lastRead: entry.last_read_date ?? null,
          $updatedAt: entry.updated_at ?? null,
          $raw: JSON.stringify(entry),
          $now: now,
        });
    });
    write();
  }

  /**
   * This reader's ratings keyed by *work* id — the id the shelf renders as
   * `Book.id` — via the `books` rows the reconcile stamped with `hardcover_id`.
   * An entry per shelved book with its rating (`null` where the shelf entry
   * carries none) and reading status, so a key's presence doubles as "on
   * their shelves" and the status decides the mark-as-read ask (ADR 0014).
   *
   * The last read date rides along so the shelf can group by read year without
   * a second round trip (docs/features/library-sort-and-group.md).
   */
  ratingsByWork(userId: number): Record<string, HardcoverShelfEntry> {
    const rows = this.db
      .query(
        `SELECT b.work_id AS workId, hub.rating AS rating, hub.status_id AS statusId,
                hub.last_read_date AS lastReadDate
           FROM hardcover_user_books hub
           JOIN books b ON b.hardcover_id = hub.hardcover_book_id
          WHERE hub.user_id = $userId AND b.work_id IS NOT NULL`,
      )
      .all({ $userId: userId }) as ({ workId: number } & HardcoverShelfEntry)[];

    const ratings: Record<string, HardcoverShelfEntry> = {};
    for (const row of rows) {
      ratings[String(row.workId)] = {
        rating: row.rating,
        statusId: row.statusId,
        lastReadDate: row.lastReadDate,
      };
    }
    return ratings;
  }

  /**
   * The slug of one mirrored book — what {@link hardcoverBookUrl} turns into a
   * link out. Read from the mirror rather than their API so a book stays
   * linkable for a reader with no token of their own.
   */
  slug(hardcoverBookId: number): string | null {
    const row = this.db
      .query("SELECT slug FROM hardcover_books WHERE hardcover_id = $id")
      .get({ $id: hardcoverBookId }) as { slug: string | null } | null;
    return row?.slug ?? null;
  }

  /**
   * The Hardcover side of one work, for a rating write-back (ADR 0014):
   * which Hardcover book the work contains, and — if this reader shelved it —
   * the `user_books` row the mutation targets. `userBookId` null means the
   * write needs the reader's leave to add the book to their shelves first.
   */
  shelfEntryForWork(
    userId: number,
    workId: number,
  ): { hardcoverBookId: number; userBookId: number | null } | null {
    const row = this.db
      .query(
        `SELECT b.hardcover_id AS hardcoverBookId, hub.user_book_id AS userBookId
           FROM books b
           LEFT JOIN hardcover_user_books hub
             ON hub.hardcover_book_id = b.hardcover_id AND hub.user_id = $userId
          WHERE b.work_id = $workId AND b.hardcover_id IS NOT NULL`,
      )
      .get({ $userId: userId, $workId: workId }) as {
      hardcoverBookId: number;
      userBookId: number | null;
    } | null;
    return row;
  }

  /**
   * Reflect a rating Hardcover just accepted, so the shelf shows it without
   * waiting for the next sweep. Null keeps the entry and clears the stars,
   * matching what `update_user_book(rating: null)` did on their side. With a
   * `statusId`, the write also flipped the status — the mark-as-read ask.
   */
  setRating(
    userId: number,
    hardcoverBookId: number,
    rating: number | null,
    statusId?: number,
  ): void {
    this.db
      .query(
        `UPDATE hardcover_user_books
            SET rating = $rating, status_id = COALESCE($statusId, status_id)
          WHERE user_id = $userId AND hardcover_book_id = $bookId`,
      )
      .run({
        $userId: userId,
        $bookId: hardcoverBookId,
        $rating: rating,
        $statusId: statusId ?? null,
      });
  }

  /** Reflect a status change Hardcover just accepted, leaving the rating alone. */
  setStatus(userId: number, hardcoverBookId: number, statusId: number): void {
    this.db
      .query(
        `UPDATE hardcover_user_books SET status_id = $statusId
          WHERE user_id = $userId AND hardcover_book_id = $bookId`,
      )
      .run({ $userId: userId, $bookId: hardcoverBookId, $statusId: statusId });
  }

  /**
   * Record a shelf entry `insert_user_book` just created (ADR 0014) — the
   * minimum the mirror needs until the next sweep replaces it with Hardcover's
   * full row. The book itself is already mirrored: only shelved books get
   * write-backs, and this one just joined the shelves of a synced library.
   */
  recordShelfEntry(
    userId: number,
    hardcoverBookId: number,
    userBookId: number,
    statusId: number,
    rating: number | null,
  ): void {
    this.db
      .query(
        `INSERT INTO hardcover_user_books (
           user_id, hardcover_book_id, user_book_id, status_id, rating, owned,
           raw, synced_at
         ) VALUES ($userId, $bookId, $userBookId, $statusId, $rating, 0, $raw, $now)
         ON CONFLICT (user_id, hardcover_book_id) DO UPDATE SET
           user_book_id = excluded.user_book_id, status_id = excluded.status_id,
           rating = excluded.rating, synced_at = excluded.synced_at`,
      )
      .run({
        $userId: userId,
        $bookId: hardcoverBookId,
        $userBookId: userBookId,
        $statusId: statusId,
        $rating: rating,
        $raw: JSON.stringify({ id: userBookId, status_id: statusId, rating }),
        $now: new Date().toISOString(),
      });
  }

  /**
   * Drop this reader's entries for books the sweep did not return — they have
   * been un-shelved. Books stay in `hardcover_books`: another reader may hold
   * them, and a book nobody holds costs one row.
   *
   * Entries mirrored in the last minute are spared: a write-back records its
   * entry here immediately, but Hardcover's read replica can lag their write —
   * a sweep racing that lag would erase a book the reader just shelved.
   */
  deleteMissing(userId: number, keep: number[]): number {
    const held = this.db
      .query(
        `SELECT hardcover_book_id AS id, synced_at AS syncedAt
           FROM hardcover_user_books WHERE user_id = $userId`,
      )
      .all({ $userId: userId }) as { id: number; syncedAt: string }[];

    const keeping = new Set(keep);
    const cutoff = new Date(Date.now() - 60_000).toISOString();
    const gone = held.filter((row) => !keeping.has(row.id) && row.syncedAt < cutoff);
    if (gone.length === 0) return 0;

    const remove = this.db.query(
      "DELETE FROM hardcover_user_books WHERE user_id = $userId AND hardcover_book_id = $id",
    );
    this.db.transaction(() => {
      for (const row of gone) remove.run({ $userId: userId, $id: row.id });
    })();
    return gone.length;
  }

  close(): void {
    this.db.close();
  }
}
