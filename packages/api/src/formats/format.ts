import type { UploadedBook, UploadFormat } from "@grimoire/core";

/** What a parser read out of one file: the book, and its cover's bytes if it had one. */
export interface ExtractedBook {
  book: UploadedBook;
  cover: Uint8Array | null;
}

/**
 * One file format Grimoire can take in (ADR 0021). The registry in
 * `./index.ts` is the only thing the upload route talks to, so a new format
 * is one of these and one entry in `UPLOAD_FORMATS`.
 */
export interface BookFormat {
  format: UploadFormat;
  /** Whether these bytes could be this format — a header check, not a parse. */
  sniff(bytes: Uint8Array): boolean;
  /**
   * The metadata and cover inside. Throws `UnreadableFileError` for a file
   * that is this format by name but cannot be read as one. `fallbackTitle` is
   * the title when the file names none, so nothing lands untitled.
   */
  extract(bytes: Uint8Array, fallbackTitle: string): ExtractedBook;
}

/** A file that claims a format but cannot be read as one. The message is shown to the reader. */
export class UnreadableFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnreadableFileError";
  }
}
