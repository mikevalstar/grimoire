import { Library } from "lucide-react";
import { useMemo } from "react";
import { type MarkIcon, sourceMark } from "@/components/book-marks";
import { ToolbarMenuTrigger } from "@/components/toolbar-menu-trigger";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BOOK_SOURCE, type LibraryBook } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Which sources the shelf is narrowed to. Empty means *all* rather than none:
 * a filter nobody has touched shows everything, and so does one whose last
 * checkbox was just cleared (docs/features/library-source-filter.md).
 */
export type SourceFilterValue = readonly string[];

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
function sourceLabel(source: string): { label: string; icon: MarkIcon } {
  const mark = sourceMark(source);
  if (mark) return { label: mark.label, icon: mark.icon };
  return { label: source.charAt(0).toUpperCase() + source.slice(1), icon: Library };
}

export interface LibrarySourceFilterProps {
  /** The sources present in the library — see `librarySources`. */
  sources: readonly string[];
  value: SourceFilterValue;
  onValueChange: (value: string[]) => void;
  className?: string;
}

/**
 * The filter bar's source picker: a multi-select over the sources the library
 * actually holds. Renders nothing at all when there is only one of them —
 * there is no choice to offer. See docs/features/library-source-filter.md.
 */
export function LibrarySourceFilter({
  sources,
  value,
  onValueChange,
  className,
}: LibrarySourceFilterProps) {
  // Only sources still present can be selected, so a source that leaves the
  // library can't keep filtering it out invisibly.
  const selected = useMemo(
    () => value.filter((source) => sources.includes(source)),
    [value, sources],
  );
  const filtered = selected.length > 0 && selected.length < sources.length;

  if (sources.length < 2) return null;

  const toggle = (source: string, checked: boolean) => {
    const next = checked ? [...selected, source] : selected.filter((one) => one !== source);
    // Clearing the last one means "all" again — an empty shelf is never what
    // unchecking a box was asking for.
    onValueChange(next.length === sources.length ? [] : next);
  };

  const label = filtered
    ? selected.length === 1
      ? sourceLabel(selected[0]).label
      : `${selected.length} sources`
    : "Source";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ToolbarMenuTrigger
          active={filtered}
          className={cn(filtered && "border-you/40 bg-you-dim", className)}
          aria-label={
            filtered
              ? `Sources: ${selected
                  .map(sourceLabel)
                  .map((s) => s.label)
                  .join(", ")}`
              : "Filter by source"
          }
        >
          <Library size={13} />
          <span className="hidden sm:inline">{label}</span>
        </ToolbarMenuTrigger>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuCheckboxItem
          checked={!filtered}
          onSelect={(event) => event.preventDefault()}
          onCheckedChange={() => onValueChange([])}
          className={cn(!filtered && "text-foreground font-medium")}
        >
          All sources
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {sources.map((source) => {
          const { label: name, icon: Icon } = sourceLabel(source);
          const checked = selected.includes(source);
          return (
            <DropdownMenuCheckboxItem
              key={source}
              checked={checked}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(next) => toggle(source, next === true)}
              className={cn(checked && "text-foreground font-medium")}
            >
              <Icon size={13} aria-hidden="true" className="text-muted-foreground" />
              {name}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
