import type { Database } from "bun:sqlite";
import { resolveDatabase } from "./db.ts";
import type { ReadStates } from "./schemas.ts";

interface ReadStateRow {
  work_id: number;
  finished_at: string | null;
}

/**
 * A reader's local read state, keyed by work like their ratings: unread is the
 * absence of a row, so "unmarked" and "never marked" stay the same thing. Only
 * consulted while the reader's read-state source is local — a linked reader on
 * the Hardcover source reads status 3 off their shelves instead.
 * See docs/features/marking-a-book-read.md.
 */
export class ReadStatesStore {
  private db: Database;

  constructor(source?: Database | string) {
    this.db = resolveDatabase(source);
  }

  /** Everything this reader has marked read, keyed by work id. */
  forUser(userId: number): ReadStates {
    const rows = this.db
      .query("SELECT work_id, finished_at FROM read_states WHERE user_id = $userId")
      .all({ $userId: userId }) as ReadStateRow[];

    const states: ReadStates = {};
    for (const row of rows) states[String(row.work_id)] = { finishedAt: row.finished_at };
    return states;
  }

  /**
   * Mark read, with the finished-when at whatever precision the reader gave —
   * or null for read-but-don't-know-when. Re-marking replaces the date.
   */
  set(userId: number, workId: number, finishedAt: string | null): void {
    this.db
      .query(
        "INSERT INTO read_states (user_id, work_id, finished_at, updated_at) " +
          "VALUES ($userId, $workId, $finishedAt, $updatedAt) " +
          "ON CONFLICT (user_id, work_id) DO UPDATE SET " +
          "finished_at = $finishedAt, updated_at = $updatedAt",
      )
      .run({
        $userId: userId,
        $workId: workId,
        $finishedAt: finishedAt,
        $updatedAt: new Date().toISOString(),
      });
  }

  /** Back to unread — the row goes, so unmarked and never-marked stay one thing. */
  clear(userId: number, workId: number): void {
    this.db
      .query("DELETE FROM read_states WHERE user_id = $userId AND work_id = $workId")
      .run({ $userId: userId, $workId: workId });
  }

  close(): void {
    this.db.close();
  }
}
