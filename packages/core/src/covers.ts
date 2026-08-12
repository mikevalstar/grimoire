import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { defaultDataDir } from "./db.ts";
import { COVER_SIZE_NAMES, COVER_SIZES, type CoverSize } from "./types.ts";

/**
 * Cached book covers on disk (ADR 0007, ADR 0011).
 *
 * Files are named by the **Grimoire** book id, not Calibre's. That is what lets
 * a book keep its cover after being deleted from Calibre, and it means the
 * browser never has to learn that a Calibre id exists.
 *
 * The whole tree is disposable: deleting it costs a re-sync and nothing else.
 */
export class CoverStore {
  readonly root: string;

  constructor(dataDir: string = defaultDataDir()) {
    this.root = join(dataDir, "covers");
  }

  /**
   * `covers/<bucket>/<id>-<size>.jpg`, bucketed by id so no single directory
   * holds three files per book for a hundred-thousand-book library.
   */
  path(bookId: number, size: CoverSize): string {
    const bucket = (bookId % 256).toString(16).padStart(2, "0");
    return join(this.root, bucket, `${bookId}-${size}.jpg`);
  }

  async write(bookId: number, size: CoverSize, bytes: ArrayBuffer | Uint8Array): Promise<void> {
    const file = this.path(bookId, size);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  }

  async exists(bookId: number, size: CoverSize): Promise<boolean> {
    try {
      await stat(this.path(bookId, size));
      return true;
    } catch {
      return false;
    }
  }

  /** True only when every size is on disk — a partial set is a cache miss. */
  async hasAll(bookId: number): Promise<boolean> {
    for (const size of COVER_SIZE_NAMES) {
      if (!(await this.exists(bookId, size))) return false;
    }
    return true;
  }

  async remove(bookId: number): Promise<void> {
    for (const size of COVER_SIZE_NAMES) {
      await rm(this.path(bookId, size), { force: true });
    }
  }

  /** The path Calibre scales a cover at, relative to the content server root. */
  static calibrePath(calibreId: number, size: CoverSize): string {
    const { width, height } = COVER_SIZES[size];
    return `/get/thumb/${calibreId}?sz=${width}x${height}`;
  }
}
