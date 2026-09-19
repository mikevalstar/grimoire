import { FileText } from "lucide-react";
import { useMemo } from "react";
import { type ChoiceFilterValue, LibraryChoiceFilter } from "@/components/library-choice-filter";
import type { LibraryBook } from "@/lib/api";

/** Selected formats; empty means all (docs/features/library-format-filter.md). */
export type FormatFilterValue = ChoiceFilterValue;

/**
 * Every format a work has a file in, across all its members. `formats` comes
 * from whichever member outranked the others, so a Calibre EPUB paired with a
 * MOBI uploaded into Grimoire would otherwise hide the MOBI
 * (docs/features/uploading-a-book.md).
 */
export function bookFormats(book: LibraryBook): string[] {
  return [...new Set([...book.formats, ...book.uploadedFormats])];
}

/** Every format the library actually holds a file in, alphabetically. */
export function libraryFormats(books: readonly LibraryBook[] | undefined): string[] {
  const present = new Set<string>();
  for (const book of books ?? []) for (const format of bookFormats(book)) present.add(format);
  return [...present].sort((a, b) => a.localeCompare(b));
}

/**
 * A work belongs to the filtered shelf when it has a file in *any* selected
 * format — so a work with no file at all never does.
 */
export function matchesFormatFilter(book: LibraryBook, value: FormatFilterValue): boolean {
  if (value.length === 0) return true;
  return bookFormats(book).some((format) => value.includes(format));
}

export interface LibraryFormatFilterProps {
  /** The formats present in the library — see `libraryFormats`. */
  formats: readonly string[];
  value: FormatFilterValue;
  onValueChange: (value: string[]) => void;
  className?: string;
}

/**
 * The filter bar's format picker: the shared choice filter over the file
 * formats the library actually holds. See docs/features/library-format-filter.md.
 */
export function LibraryFormatFilter({ formats, ...props }: LibraryFormatFilterProps) {
  const options = useMemo(
    () => formats.map((format) => ({ value: format, label: format })),
    [formats],
  );
  return (
    <LibraryChoiceFilter
      noun={{ one: "format", many: "formats" }}
      icon={FileText}
      options={options}
      {...props}
    />
  );
}
