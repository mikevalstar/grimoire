import type { Database } from "bun:sqlite";
import { resolveDatabase } from "./db.ts";
import type { Ratings } from "./schemas.ts";

interface RatingRow {
  work_id: number;
  rating: number;
}

/**
 * A reader's own stars, keyed by `works.id` (ADR 0013). It was a Calibre id
 * once, then a `books.id` (ADR 0011); each move was the same lesson, that a
 * rating must not be keyed to something a source can revoke or duplicate. A
 * work is the book itself, however many sources turn out to carry it — so a
 * rating survives its book gaining a second one.
 *
 * Per-reader by construction: every method takes a user id, because there is no
 * such thing as "the" rating of a book here (ADR 0008). Nothing in this store
 * touches Calibre.
 *
 * See docs/features/rating-a-book.md.
 */
export class RatingsStore {
  private db: Database;

  constructor(source?: Database | string) {
    this.db = resolveDatabase(source);
  }

  /**
   * Everything this reader has rated, keyed by work id — the same id the book
   * list carries as `Book.id`. Unrated books are absent rather than zero.
   */
  forUser(userId: number): Ratings {
    const rows = this.db
      .query("SELECT work_id, rating FROM ratings WHERE user_id = $userId")
      .all({ $userId: userId }) as RatingRow[];

    const ratings: Ratings = {};
    for (const row of rows) ratings[String(row.work_id)] = row.rating;
    return ratings;
  }

  get(userId: number, workId: number): number | null {
    const row = this.db
      .query("SELECT rating FROM ratings WHERE user_id = $userId AND work_id = $workId")
      .get({ $userId: userId, $workId: workId }) as { rating: number } | null;
    return row?.rating ?? null;
  }

  /**
   * Set this reader's rating, or clear it with 0 — the only way back to
   * unrated, and why the row is deleted rather than zeroed.
   * Returns what's stored afterwards.
   */
  set(userId: number, workId: number, rating: number): number | null {
    if (rating <= 0) {
      this.clear(userId, workId);
      return null;
    }

    this.db
      .query(
        "INSERT INTO ratings (user_id, work_id, rating, updated_at) " +
          "VALUES ($userId, $workId, $rating, $updatedAt) " +
          "ON CONFLICT (user_id, work_id) DO UPDATE SET rating = $rating, updated_at = $updatedAt",
      )
      .run({
        $userId: userId,
        $workId: workId,
        $rating: rating,
        $updatedAt: new Date().toISOString(),
      });

    return rating;
  }

  clear(userId: number, workId: number): void {
    this.db
      .query("DELETE FROM ratings WHERE user_id = $userId AND work_id = $workId")
      .run({ $userId: userId, $workId: workId });
  }

  close(): void {
    this.db.close();
  }
}
