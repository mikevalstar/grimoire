import type { Database } from "bun:sqlite";
import { resolveDatabase } from "./db.ts";
import type { HcUserBook } from "./schemas.ts";

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
             release_date, slug, tags, cover_url, raw, synced_at
           ) VALUES (
             $id, $title, $subtitle, $authors, $description, $pages,
             $releaseDate, $slug, $tags, $coverUrl, $raw, $now
           )
           ON CONFLICT (hardcover_id) DO UPDATE SET
             title = excluded.title, subtitle = excluded.subtitle,
             authors = excluded.authors, description = excluded.description,
             pages = excluded.pages, release_date = excluded.release_date,
             slug = excluded.slug, tags = excluded.tags,
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
   * Drop this reader's entries for books the sweep did not return — they have
   * been un-shelved. Books stay in `hardcover_books`: another reader may hold
   * them, and a book nobody holds costs one row.
   */
  deleteMissing(userId: number, keep: number[]): number {
    const held = this.db
      .query("SELECT hardcover_book_id AS id FROM hardcover_user_books WHERE user_id = $userId")
      .all({ $userId: userId }) as { id: number }[];

    const keeping = new Set(keep);
    const gone = held.filter((row) => !keeping.has(row.id));
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
