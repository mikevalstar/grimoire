import type { Database } from "bun:sqlite";
import { resolveDatabase } from "./db.ts";
import type { Ratings } from "./schemas.ts";

interface RatingRow {
  book_id: number;
  rating: number;
}

/**
 * A reader's own stars, keyed by Grimoire's own `books.id` (ADR 0011 — it used
 * to be a Calibre id, which meant a rating could outlive its book as an orphan
 * pointing at a number nothing owned). Per-reader by construction — every
 * method takes a user id, because there is no such thing as "the" rating of a
 * book here (ADR 0008). Nothing in this store touches Calibre.
 *
 * See docs/features/rating-a-book.md.
 */
export class RatingsStore {
  private db: Database;

  constructor(source?: Database | string) {
    this.db = resolveDatabase(source);
  }

  /**
   * Everything this reader has rated, as a book-id-keyed map — the shape the
   * book list merges against. Unrated books are absent rather than zero.
   */
  forUser(userId: number): Ratings {
    const rows = this.db
      .query("SELECT book_id, rating FROM ratings WHERE user_id = $userId")
      .all({ $userId: userId }) as RatingRow[];

    const ratings: Ratings = {};
    for (const row of rows) ratings[String(row.book_id)] = row.rating;
    return ratings;
  }

  get(userId: number, bookId: number): number | null {
    const row = this.db
      .query("SELECT rating FROM ratings WHERE user_id = $userId AND book_id = $bookId")
      .get({ $userId: userId, $bookId: bookId }) as { rating: number } | null;
    return row?.rating ?? null;
  }

  /**
   * Set this reader's rating, or clear it with 0 — the only way back to
   * unrated, and why the row is deleted rather than zeroed.
   * Returns what's stored afterwards.
   */
  set(userId: number, bookId: number, rating: number): number | null {
    if (rating <= 0) {
      this.clear(userId, bookId);
      return null;
    }

    this.db
      .query(
        "INSERT INTO ratings (user_id, book_id, rating, updated_at) " +
          "VALUES ($userId, $bookId, $rating, $updatedAt) " +
          "ON CONFLICT (user_id, book_id) DO UPDATE SET rating = $rating, updated_at = $updatedAt",
      )
      .run({
        $userId: userId,
        $bookId: bookId,
        $rating: rating,
        $updatedAt: new Date().toISOString(),
      });

    return rating;
  }

  clear(userId: number, bookId: number): void {
    this.db
      .query("DELETE FROM ratings WHERE user_id = $userId AND book_id = $bookId")
      .run({ $userId: userId, $bookId: bookId });
  }

  close(): void {
    this.db.close();
  }
}
