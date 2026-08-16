import { useVirtualizer } from "@tanstack/react-virtual";
import { type RefObject, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BookCover } from "@/components/book-cover";
import { BookDownloadButton } from "@/components/book-download-button";
import { BookMarks } from "@/components/book-marks";
import { FilterLink } from "@/components/filter-link";
import { ReadCorner } from "@/components/read-corner";
import { StarRating } from "@/components/star-rating";
import { Skeleton } from "@/components/ui/skeleton";
import { bookRating, type HardcoverRatings, type LibraryBook, type Ratings } from "@/lib/api";
import type { FilterField } from "@/lib/book-filter";
import type { BookSection } from "@/lib/library-order";
import { cn } from "@/lib/utils";
import { useVirtualScrollMargin } from "@/lib/virtual-scroll";

export interface BookGridProps {
  /**
   * The shelf in labelled runs (docs/features/library-sort-and-group.md) — a
   * single null-labelled section is the ungrouped case and draws no headers.
   */
  sections: BookSection[];
  /**
   * Opening a book — the [details panel](../../../../docs/features/book-details-panel.md).
   * Cards are only clickable when this is given: a hover affordance that leads
   * nowhere is a lie.
   */
  onOpen?: (book: LibraryBook) => void;
  /** The reader's own ratings, which stand in front of Calibre's. */
  ratings?: Ratings | HardcoverRatings;
  /** Set a rating. Without it the stars stay a read-out. */
  onRate?: (book: LibraryBook, rating: number) => void;
  /**
   * Whether this book's stars are a control — a Calibre-only book can't be
   * rated while the reader's source is Hardcover (ADR 0014). Absent, every
   * book is.
   */
  ratable?: (book: LibraryBook) => boolean;
  /** The dog-ear (docs/features/marking-a-book-read.md). Absent, no corners. */
  isRead?: (book: LibraryBook) => boolean;
  /** Open the confirm for the other state. Without it a read corner is a read-out. */
  onToggleRead?: (book: LibraryBook, read: boolean) => void;
  /**
   * Narrow the shelf to an author or a series
   * (docs/features/library-quick-filter.md). Without it a card's author and
   * series lines are plain text, which is what they were before this.
   */
  onFilter?: (field: FilterField, value: string) => void;
  /** The library-owned vertical scrollport. Without it, render the complete small sample. */
  scrollElement?: HTMLElement | null;
  className?: string;
}

interface GridBookRow {
  kind: "books";
  key: string;
  books: LibraryBook[];
}

interface GridHeadingRow {
  kind: "heading";
  key: string;
  label: string;
  count: number;
}

type GridRow = GridBookRow | GridHeadingRow;

/** The shelf: covers first, metadata under them, reflowing to any width. */
export function BookGrid({
  sections,
  onOpen,
  ratings,
  onRate,
  ratable,
  isRead,
  onToggleRead,
  onFilter,
  scrollElement,
  className,
}: BookGridProps) {
  // `undefined` means a standalone story with no owning scrollport; `null`
  // means BookLibrary has requested virtualization and its ref is not mounted
  // yet. Keeping those distinct avoids mounting every card on the first pass.
  const virtual = scrollElement !== undefined;
  const listRef = useRef<HTMLDivElement>(null);
  const [width, columns] = useGridColumns(listRef);
  const rows = useMemo(() => gridRows(sections, columns), [sections, columns]);
  const scrollMargin = useVirtualScrollMargin(listRef, scrollElement ?? null);
  const estimatedCardHeight = Math.max(
    260,
    ((width - Math.max(0, columns - 1) * GRID_COLUMN_GAP) / columns) * 1.5 + 78,
  );
  const virtualizer = useVirtualizer<HTMLElement, HTMLDivElement>({
    count: rows.length,
    getScrollElement: () => scrollElement ?? null,
    getItemKey: (index) => rows[index]?.key ?? index,
    estimateSize: (index) => (rows[index]?.kind === "heading" ? 27 : estimatedCardHeight),
    gap: GRID_ROW_GAP,
    overscan: 3,
    scrollMargin,
    enabled: virtual,
    useFlushSync: false,
  });

  const visibleRows = virtual
    ? virtualizer.getVirtualItems()
    : rows.map((row, index) => ({ index, key: row.key, start: 0 }));

  return (
    // biome-ignore lint/a11y/useSemanticElements: virtual row wrappers prevent valid native ul/li nesting.
    <div
      ref={listRef}
      role="list"
      className={cn(virtual ? "relative" : "flex flex-col gap-6", className)}
      style={virtual ? { height: virtualizer.getTotalSize() } : undefined}
    >
      {visibleRows.map((virtualRow) => {
        const row = rows[virtualRow.index];
        if (!row) return null;
        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtual ? virtualizer.measureElement : undefined}
            className={virtual ? "absolute top-0 left-0 w-full" : undefined}
            style={
              virtual
                ? { transform: `translateY(${virtualRow.start - scrollMargin}px)` }
                : undefined
            }
          >
            {row.kind === "heading" ? (
              <GridHeading label={row.label} count={row.count} first={virtualRow.index === 0} />
            ) : (
              <div
                className="grid gap-x-4"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
              >
                {row.books.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    ratings={ratings}
                    onRate={onRate}
                    ratable={ratable}
                    isRead={isRead}
                    onToggleRead={onToggleRead}
                    onFilter={onFilter}
                    onOpen={onOpen}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GridHeading({ label, count, first }: { label: string; count: number; first: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 pt-3", first && "pt-0")}>
      <h2 className="text-foreground/80 text-[12px] font-semibold tracking-[0.08em] uppercase">
        {label}
      </h2>
      <span className="text-muted-foreground text-[11px] tabular-nums">{count}</span>
      <span aria-hidden="true" className="border-line flex-1 border-t" />
    </div>
  );
}

interface BookCardProps extends Omit<BookGridProps, "sections" | "scrollElement" | "className"> {
  book: LibraryBook;
}

function BookCard({
  book,
  onOpen,
  ratings,
  onRate,
  ratable,
  isRead,
  onToggleRead,
  onFilter,
}: BookCardProps) {
  const cover = (
    <BookCover
      book={book}
      width={180}
      // Hovered, a cover casts a deeper shadow *and* an indigo glow under it,
      // with the ring at full strength — the same pairing used for focus.
      className="group-hover/book:ring-you/70 shadow-[0_8px_20px_-10px_rgba(0,0,0,0.8)] transition-shadow duration-300 group-hover/book:shadow-[0_18px_36px_-12px_rgba(0,0,0,0.9),0_10px_30px_-8px_var(--you-glow)] group-hover/book:ring-2"
    />
  );

  return (
    // The lift belongs to the whole card, so the download button rides along
    // with the cover. A column pins the stars to the bottom of every card.
    // biome-ignore lint/a11y/useSemanticElements: cards sit inside virtual row wrappers, not a native ul.
    <div role="listitem" className="group/book flex min-w-0 flex-col">
      <div className="ease-spring relative transition-transform duration-300 motion-safe:group-hover/book:-translate-y-1.5">
        {onOpen ? (
          <button
            type="button"
            onClick={() => onOpen(book)}
            aria-label={book.title}
            className="focus-visible:ring-ring/50 block w-full rounded-md focus-visible:ring-[3px] focus-visible:outline-none"
          >
            {cover}
          </button>
        ) : (
          cover
        )}
        {/* a sibling of the card button, never a child: no link inside a button */}
        <BookDownloadButton
          book={book}
          variant="overlay"
          className="absolute bottom-2 left-1/2 -translate-x-1/2"
        />
        {/* On the cover rather than under it: the metadata lines below are
                  reserved to a fixed height so stars line up across a row, and
                  an extra line here would break that alignment.

                  Bottom left, where a cover's artwork is least often busy, and
                  clear of the download button that appears centred on hover —
                  with room to the right for a book that carries more than one
                  mark. */}
        <BookMarks
          book={book}
          variant="overlay"
          className="absolute bottom-1.5 left-1.5 max-w-[calc(50%-1rem)]"
        />
        {/* The dog-ear, bottom right — the one corner nothing else claims. */}
        {isRead && (
          <ReadCorner
            read={isRead(book)}
            label={book.title}
            onToggle={onToggleRead && ((read) => onToggleRead(book, read))}
          />
        )}
      </div>

      {/* Every card spends the same number of lines on metadata — one
                each for title, author and series — so the stars land on one
                line right across the shelf whether or not a book is in a
                series. `lh` is "one line box of this text", so the reservation
                follows the type rather than a magic pixel height. */}
      <p className="text-foreground/85 group-hover/book:text-foreground mt-2 min-h-[1lh] truncate text-[13px] leading-snug font-medium transition-colors">
        {book.title}
      </p>
      {/* An author's name and a series' name are identities, not prose, so
                each is a way into the shelf rather than a label — see
                docs/features/library-quick-filter.md. */}
      <p className="text-muted-foreground min-h-[1lh] truncate text-[11px]">
        {book.authors.map((author, index) => (
          <span key={author}>
            {index > 0 && ", "}
            <FilterLink field="author" value={author} onFilter={onFilter} />
          </span>
        ))}
      </p>
      <p className="text-muted-foreground/70 min-h-[1lh] truncate text-[11px]">
        {book.series && (
          <>
            <FilterLink field="series" value={book.series} onFilter={onFilter} />
            {/* The index stays plain: #3 is not a thing to filter by. */}
            {book.seriesIndex !== null && ` #${book.seriesIndex}`}
          </>
        )}
      </p>
      {/* Pinned to the bottom, so a card whose cover comes back a little
                taller doesn't push its stars out of line with the rest of the
                row. */}
      <StarRating
        value={bookRating(book, ratings)}
        onRate={onRate && (ratable?.(book) ?? true) ? (rating) => onRate(book, rating) : undefined}
        label={book.title}
        className="mt-auto pt-1"
      />
    </div>
  );
}

function gridRows(sections: BookSection[], columns: number): GridRow[] {
  const rows: GridRow[] = [];
  for (const section of sections) {
    const sectionKey = section.label ?? "all";
    if (section.label !== null) {
      rows.push({
        kind: "heading",
        key: `heading:${sectionKey}`,
        label: section.label,
        count: section.books.length,
      });
    }
    for (let index = 0; index < section.books.length; index += columns) {
      const books = section.books.slice(index, index + columns);
      rows.push({
        kind: "books",
        // The same first book can begin differently-sized rows after a
        // responsive reflow. Including the column count keeps TanStack from
        // reusing that row's old measured height.
        key: `books:${columns}:${sectionKey}:${books[0]?.id ?? index}`,
        books,
      });
    }
  }
  return rows;
}

function useGridColumns(ref: RefObject<HTMLElement | null>): [number, number] {
  const [layout, setLayout] = useState({ width: 0, columns: 1 });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth;
      const minimum = window.matchMedia("(min-width: 96rem)").matches
        ? 170
        : window.matchMedia("(min-width: 40rem)").matches
          ? 150
          : 120;
      const columns = Math.max(
        1,
        Math.floor((width + GRID_COLUMN_GAP) / (minimum + GRID_COLUMN_GAP)),
      );
      setLayout((current) =>
        current.width === width && current.columns === columns ? current : { width, columns },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return [layout.width, layout.columns];
}

const GRID_COLUMN_GAP = 16;
const GRID_ROW_GAP = 24;

const GRID =
  "grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-x-4 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] 2xl:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]";

/** Placeholder cards in the grid's own shape, so loading doesn't change the page's silhouette. */
export function BookGridSkeleton({ count = 18 }: { count?: number }) {
  return (
    <div className={GRID} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder cards, never reordered
        <div key={i}>
          <Skeleton className="aspect-2/3 w-full rounded-md" />
          <Skeleton className="mt-2 h-3 w-4/5" />
          <Skeleton className="mt-1.5 h-2.5 w-3/5" />
        </div>
      ))}
    </div>
  );
}
