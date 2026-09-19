import { Library } from "lucide-react";
import { useMemo } from "react";
import { type MarkIcon, sourceMark } from "@/components/book-marks";
import {
  type ChoiceFilterValue,
  type ChoiceOption,
  LibraryChoiceFilter,
} from "@/components/library-choice-filter";
import { BOOK_SOURCE, type LibraryBook } from "@/lib/api";

/** Selected sources; empty means all (docs/features/library-source-filter.md). */
export type SourceFilterValue = ChoiceFilterValue;

/** The order sources are offered in — the known ones first, anything else after. */
const KNOWN_ORDER: readonly string[] = [
  BOOK_SOURCE.calibre,
  BOOK_SOURCE.hardcover,
  BOOK_SOURCE.grimoire,
];

/** Every source the library actually holds, in a stable order. */
export function librarySources(books: readonly LibraryBook[] | undefined): string[] {
  const present = new Set<string>();
  for (const book of books ?? []) for (const source of book.sources) present.add(source);
  return [...present].sort((a, b) => {
    const rank = KNOWN_ORDER.indexOf(a) - KNOWN_ORDER.indexOf(b);
    return rank === 0 ? a.localeCompare(b) : rank;
  });
}

/** A work belongs to the filtered shelf when *any* of its sources is selected. */
export function matchesSourceFilter(book: LibraryBook, value: SourceFilterValue): boolean {
  if (value.length === 0) return true;
  return book.sources.some((source) => value.includes(source));
}

/**
 * How a source is named in the menu. Known sources reuse the marks the books
 * themselves wear (book-marks.tsx); an unknown one gets its own name and a
 * generic glyph rather than being hidden, since it is in the library either way.
 */
function sourceOption(source: string): ChoiceOption {
  const mark = sourceMark(source);
  const icon: MarkIcon = mark?.icon ?? Library;
  const label = mark?.label ?? source.charAt(0).toUpperCase() + source.slice(1);
  return { value: source, label, icon };
}

export interface LibrarySourceFilterProps {
  /** The sources present in the library — see `librarySources`. */
  sources: readonly string[];
  value: SourceFilterValue;
  onValueChange: (value: string[]) => void;
  className?: string;
}

/**
 * The filter bar's source picker: the shared choice filter over the sources
 * the library actually holds, each wearing its brand mark.
 * See docs/features/library-source-filter.md.
 */
export function LibrarySourceFilter({ sources, ...props }: LibrarySourceFilterProps) {
  const options = useMemo(() => sources.map(sourceOption), [sources]);
  return (
    <LibraryChoiceFilter
      noun={{ one: "source", many: "sources" }}
      icon={Library}
      options={options}
      {...props}
    />
  );
}
