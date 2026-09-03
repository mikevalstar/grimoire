import { rm, stat } from "node:fs/promises";
import {
  type BookFilesStore,
  type BooksStore,
  type CoverStore,
  UPLOAD_MAX_BYTES,
  type UploadResult,
  type WorksStore,
} from "@grimoire/core";
import { formatForName, UnreadableFileError } from "./formats/index.ts";
import { writeCoverSizes } from "./remote-covers.ts";

/** A refusal the reader should see, with the status it travels under. */
export class UploadError extends Error {
  constructor(
    readonly status: 400 | 413 | 415,
    message: string,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

export interface UploadDeps {
  books: BooksStore;
  files: BookFilesStore;
  covers: CoverStore;
  works: WorksStore;
}

export interface UploadInput {
  /** Where the request body was written. Consumed: moved into place or deleted. */
  tempFile: string;
  /** The name the reader's file had, for the format and the fallback title. */
  originalName: string;
  /** The reader who uploaded it, for attribution only (ADR 0008). */
  addedBy: number | null;
  now: string;
}

/** SHA-256 of a file on disk, streamed rather than read whole — the file can be large. */
async function sha256Of(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  for await (const chunk of Bun.file(path).stream()) hasher.update(chunk);
  return hasher.digest("hex");
}

/** A zip entry is a view into the archive's buffer; the decoder wants the bytes alone. */
export function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

/** "My Book.epub" → "My Book"; dots and underscores standing in for spaces are given back. */
function titleFromName(name: string): string {
  const stem = name.replace(/\.[^.]+$/, "");
  return (stem.includes(" ") ? stem : stem.replace(/[._]+/g, " ")).trim() || name;
}

/**
 * Turn a file the reader handed over into a book on the shelf
 * (docs/features/uploading-a-book.md). In order: refuse what cannot be taken,
 * find it if it is already here, read it, and only then insert — so a refusal
 * leaves nothing behind, and the row exists only once the file is in place.
 *
 * Runs the matcher afterwards, so an EPUB of a book Calibre already lists
 * becomes a second entry of that work rather than a second card.
 */
export async function ingestUpload(
  { books, files, covers, works }: UploadDeps,
  { tempFile, originalName, addedBy, now }: UploadInput,
  /** Where each stage's milliseconds go, for finding the slow one. */
  report: (timings: string) => void = () => {},
): Promise<UploadResult> {
  const timings: string[] = [];
  let mark = performance.now();
  const lap = (stage: string) => {
    const next = performance.now();
    timings.push(`${stage} ${(next - mark).toFixed(0)}ms`);
    mark = next;
  };

  try {
    const format = formatForName(originalName);
    if (!format) {
      throw new UploadError(415, `Grimoire can't take "${originalName}" — only EPUB files, today.`);
    }

    const { size } = await stat(tempFile);
    if (size === 0) throw new UploadError(400, `"${originalName}" is empty.`);
    if (size > UPLOAD_MAX_BYTES) {
      throw new UploadError(
        413,
        `"${originalName}" is over the ${UPLOAD_MAX_BYTES / 1024 / 1024} MB limit.`,
      );
    }

    const sha256 = await sha256Of(tempFile);
    lap("hash");
    const existing = files.findBySha256(sha256);
    if (existing) return { bookId: existing.workId, existing: true };

    const bytes = new Uint8Array(await Bun.file(tempFile).arrayBuffer());
    lap("read");
    if (!format.sniff(bytes)) {
      throw new UploadError(415, `"${originalName}" is not an ${format.format} file inside.`);
    }

    let extracted: ReturnType<typeof format.extract>;
    try {
      extracted = format.extract(bytes, titleFromName(originalName));
    } catch (err) {
      if (err instanceof UnreadableFileError) throw new UploadError(400, err.message);
      throw err;
    }
    lap("parse");

    const { bookId, workId } = books.insertUpload(extracted.book, now);
    await files.add(
      tempFile,
      { bookId, format: format.format, size, sha256, originalName, addedBy },
      now,
    );

    lap("store");

    if (extracted.cover) {
      const ok = await writeCoverSizes(covers, bookId, toArrayBuffer(extracted.cover));
      books.markCover(bookId, ok ? "cached" : "missing", now);
      lap("cover");
    }

    works.matchAll();
    lap("match");
    // The matcher may have moved the row into another work.
    return { bookId: books.workIdOf(bookId) ?? workId, existing: false };
  } finally {
    report(timings.join(", "));
    await rm(tempFile, { force: true });
  }
}

/**
 * Take a work's uploaded entries out — files first, then rows
 * (docs/features/book-actions.md). Answers how many entries went; the caller
 * reads the work again to see whether anything is left.
 */
export async function deleteUploads(
  { books, files, covers }: UploadDeps,
  workId: number,
): Promise<number> {
  const members = books.uploadedMembers(workId);
  for (const member of members) {
    await files.removeFiles(member.id);
    await covers.remove(member.id);
  }
  books.deleteMembers(members.map((member) => member.id));
  return members.length;
}
