import { UPLOAD_FORMATS, type UploadFormat } from "@grimoire/core";
import { EPUB } from "./epub.ts";
import type { BookFormat } from "./format.ts";

export { type BookFormat, type ExtractedBook, UnreadableFileError } from "./format.ts";

/**
 * Every format Grimoire can ingest, keyed as `books.formats` spells them.
 * Typed against `UPLOAD_FORMATS` so a format the browser offers without a
 * parser behind it is a type error rather than a 415 at runtime.
 */
export const BOOK_FORMATS: Record<UploadFormat, BookFormat> = {
  EPUB,
};

/** The format a filename claims, by extension — or null for one Grimoire doesn't take. */
export function formatForName(name: string): BookFormat | null {
  const dot = name.lastIndexOf(".");
  if (dot === -1) return null;
  const extension = name.slice(dot).toLowerCase();
  for (const key of Object.keys(UPLOAD_FORMATS) as UploadFormat[]) {
    if (UPLOAD_FORMATS[key].extension === extension) return BOOK_FORMATS[key];
  }
  return null;
}
