import type { Database } from "bun:sqlite";
import { mkdir, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { defaultDataDir, resolveDatabase } from "./db.ts";

/** One file Grimoire holds, as `book_files` records it (ADR 0021). */
export interface BookFile {
  bookId: number;
  /** Uppercased, like `books.formats` — "EPUB". */
  format: string;
  size: number;
  sha256: string;
  originalName: string | null;
  addedBy: number | null;
  addedAt: string;
}

interface BookFileRow {
  book_id: number;
  format: string;
  size: number;
  sha256: string;
  original_name: string | null;
  added_by: number | null;
  added_at: string;
}

function toBookFile(row: BookFileRow): BookFile {
  return {
    bookId: row.book_id,
    format: row.format,
    size: row.size,
    sha256: row.sha256,
    originalName: row.original_name,
    addedBy: row.added_by,
    addedAt: row.added_at,
  };
}

/**
 * The book files Grimoire holds itself: the `book_files` table and the tree on
 * disk under it (docs/features/uploading-a-book.md).
 *
 * Laid out like covers — `books/<bucket>/<id>.<format>`, bucketed by Grimoire's
 * book id — so a metadata edit never moves a file and the browser never learns
 * a path. Unlike covers this tree is **not** disposable: these are the
 * originals (ADR 0021).
 */
export class BookFilesStore {
  readonly root: string;
  private db: Database;

  constructor(source?: Database | string, dataDir: string = defaultDataDir()) {
    this.db = resolveDatabase(source);
    this.root = join(dataDir, "books");
  }

  path(bookId: number, format: string): string {
    const bucket = (bookId % 256).toString(16).padStart(2, "0");
    return join(this.root, bucket, `${bookId}.${format.toLowerCase()}`);
  }

  /** Somewhere under the same tree to write an upload before it is a book. */
  async tempPath(): Promise<string> {
    const dir = join(this.root, "tmp");
    await mkdir(dir, { recursive: true });
    return join(dir, `${crypto.randomUUID()}.upload`);
  }

  /** The book already holding these exact bytes, if any — the "same file twice" test. */
  findBySha256(sha256: string): { bookId: number; workId: number } | null {
    const row = this.db
      .query(
        `SELECT f.book_id AS bookId, b.work_id AS workId
           FROM book_files f JOIN books b ON b.id = f.book_id
          WHERE f.sha256 = $sha256 LIMIT 1`,
      )
      .get({ $sha256: sha256 }) as { bookId: number; workId: number } | null;
    return row;
  }

  /** Every file held by any member of a work, in the order they arrived. */
  forWork(workId: number): BookFile[] {
    const rows = this.db
      .query(
        `SELECT f.* FROM book_files f JOIN books b ON b.id = f.book_id
          WHERE b.work_id = $workId ORDER BY f.added_at, f.book_id`,
      )
      .all({ $workId: workId }) as BookFileRow[];
    return rows.map(toBookFile);
  }

  /** The one file this member holds in this format, or null. */
  get(bookId: number, format: string): BookFile | null {
    const row = this.db
      .query("SELECT * FROM book_files WHERE book_id = $bookId AND format = $format")
      .get({ $bookId: bookId, $format: format.toUpperCase() }) as BookFileRow | null;
    return row ? toBookFile(row) : null;
  }

  /**
   * Move a finished upload into place and record it. The move comes first: a
   * row for a file that is not there would be a library that lies, whereas a
   * file with no row is an orphan the next upload of the same bytes overwrites.
   */
  async add(
    tempFile: string,
    file: Omit<BookFile, "addedAt" | "format"> & { format: string },
    now: string,
  ): Promise<BookFile> {
    const format = file.format.toUpperCase();
    const target = this.path(file.bookId, format);
    await mkdir(dirname(target), { recursive: true });
    await rename(tempFile, target);

    this.db
      .query(
        `INSERT INTO book_files (book_id, format, size, sha256, original_name, added_by, added_at)
         VALUES ($bookId, $format, $size, $sha256, $originalName, $addedBy, $now)
         ON CONFLICT (book_id, format) DO UPDATE SET
           size = excluded.size, sha256 = excluded.sha256,
           original_name = excluded.original_name, added_by = excluded.added_by,
           added_at = excluded.added_at`,
      )
      .run({
        $bookId: file.bookId,
        $format: format,
        $size: file.size,
        $sha256: file.sha256,
        $originalName: file.originalName,
        $addedBy: file.addedBy,
        $now: now,
      });
    this.syncFormats(file.bookId);

    return { ...file, format, addedAt: now };
  }

  /**
   * Take every file a member holds off the disk. The rows go with the book
   * row (ON DELETE CASCADE), so this is the half SQLite cannot do.
   */
  async removeFiles(bookId: number): Promise<void> {
    const rows = this.db
      .query("SELECT format FROM book_files WHERE book_id = $bookId")
      .all({ $bookId: bookId }) as { format: string }[];
    for (const row of rows) {
      await rm(this.path(bookId, row.format), { force: true });
    }
  }

  /**
   * Keep `books.formats` — what the shelf and the download button read —
   * saying what this table says for a Grimoire-sourced row.
   */
  private syncFormats(bookId: number): void {
    const rows = this.db
      .query("SELECT format FROM book_files WHERE book_id = $bookId ORDER BY format")
      .all({ $bookId: bookId }) as { format: string }[];
    this.db
      .query("UPDATE books SET formats = $formats WHERE id = $bookId")
      .run({ $bookId: bookId, $formats: JSON.stringify(rows.map((row) => row.format)) });
  }
}
