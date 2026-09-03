import {
  type BookFilesStore,
  type BooksStore,
  COVER_SIZE_NAMES,
  CoverStore,
  UPLOAD_FORMAT_NAMES,
  type UploadFormat,
} from "@grimoire/core";
import { BOOK_FORMATS } from "./formats/index.ts";
import { cacheRemoteCover, writeCoverSizes } from "./remote-covers.ts";
import { toArrayBuffer } from "./uploads.ts";

/** Long enough for Calibre to scale three images on a slow disk, short enough to give up. */
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * All three cached sizes for one book, from the Calibre content server, which
 * scales them for us (ADR 0011). Any failure returns false; the caller decides
 * what a failure means to the book's cover state.
 */
export async function fetchCalibreCovers(
  covers: CoverStore,
  base: string,
  bookId: number,
  calibreId: number,
): Promise<boolean> {
  for (const size of COVER_SIZE_NAMES) {
    const url = new URL(CoverStore.calibrePath(calibreId, size), `${base.replace(/\/+$/, "")}/`);

    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch {
      return false;
    }
    // A book with no cover 404s here — expected, not an error worth failing the
    // whole sync over. The views already draw a placeholder.
    if (!res.ok) return false;

    await covers.write(bookId, size, await res.arrayBuffer());
  }
  return true;
}

export interface CoverRefetchDeps {
  books: BooksStore;
  covers: CoverStore;
  /** The content server to ask, or null when none is configured — then only URLs are tried. */
  calibreServerUrl: string | null;
  /** Grimoire's own files, for a member whose cover is inside one (ADR 0021). */
  files?: BookFilesStore;
}

/**
 * A cover read back out of a file Grimoire holds — an uploaded book's only
 * source (docs/features/uploading-a-book.md). False when the file names no
 * cover or the image cannot be decoded.
 */
async function extractFileCover(
  covers: CoverStore,
  files: BookFilesStore,
  bookId: number,
  format: string,
): Promise<boolean> {
  if (!UPLOAD_FORMAT_NAMES.includes(format as UploadFormat)) return false;
  const parser = BOOK_FORMATS[format as UploadFormat];
  let cover: Uint8Array | null;
  try {
    const bytes = new Uint8Array(await Bun.file(files.path(bookId, format)).arrayBuffer());
    cover = parser.extract(bytes, "").cover;
  } catch {
    return false;
  }
  return cover !== null && (await writeCoverSizes(covers, bookId, toArrayBuffer(cover)));
}

/**
 * Fetch every member of one work's cover again and overwrite what is cached
 * (docs/features/book-actions.md) — the reader has looked at the cover and said
 * it is wrong, so this asks nothing about whether sync believes it is current.
 *
 * Members are asked in order rather than in parallel: a work has one or two of
 * them, and a pool would be more machinery than the whole action.
 *
 * A member that fails keeps the file it already has and the state that went
 * with it. Marking it `missing` would take a working cover off the shelf
 * because one refresh didn't land, which is the opposite of what was asked for.
 */
export async function refetchWorkCovers(
  { books, covers, calibreServerUrl, files }: CoverRefetchDeps,
  workId: number,
): Promise<{ attempted: number; fetched: number }> {
  let attempted = 0;
  let fetched = 0;

  // Uploaded members first: their cover is in a file on this disk, which is
  // the one source that cannot be down.
  for (const file of files?.forWork(workId) ?? []) {
    attempted++;
    if (await extractFileCover(covers, files as BookFilesStore, file.bookId, file.format)) {
      fetched++;
      books.markCover(file.bookId, "cached", new Date().toISOString());
    }
  }

  for (const member of books.coverSourcesForWork(workId)) {
    const base = member.calibreId !== null ? calibreServerUrl : null;
    if (!base && !member.url) continue;
    attempted++;

    // Calibre first where the book is still in the library: it is the edition
    // the reader owns, and it scales the sizes for us. A URL is the fallback,
    // and the only source a Hardcover-only member has.
    const ok =
      (base !== null &&
        member.calibreId !== null &&
        (await fetchCalibreCovers(covers, base, member.id, member.calibreId))) ||
      (member.url !== null && (await cacheRemoteCover(covers, member.id, member.url)));

    if (ok) {
      fetched++;
      // Now, not the book's `last_modified`: this is also the work's
      // `coverVersion`, which is what moves the cover URL past the browser's
      // year-long cache entry.
      books.markCover(member.id, "cached", new Date().toISOString());
    }
  }

  return { attempted, fetched };
}
