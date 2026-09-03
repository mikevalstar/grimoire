import { useVirtualizer } from "@tanstack/react-virtual";
import { type RefCallback, useMemo, useRef } from "react";
import { BookCover } from "@/components/book-cover";
import { BookDownloadButton } from "@/components/book-download-button";
import { BookMarks } from "@/components/book-marks";
import { StarRating } from "@/components/star-rating";
import { Skeleton } from "@/components/ui/skeleton";
import { bookRating, type HardcoverRatings, type LibraryBook, type Ratings } from "@/lib/api";
import type { BookSection } from "@/lib/library-order";
import { cn } from "@/lib/utils";
import { useVirtualScrollMargin } from "@/lib/virtual-scroll";

export interface BookTableProps {
  /** The shelf in labelled runs — a single null-labelled section draws no headers. See BookGrid. */
  sections: BookSection[];
  /** Opening a book. Rows are only clickable when this is given — see BookGrid. */
  onOpen?: (book: LibraryBook) => void;
  /** The reader's own ratings, which stand in front of Calibre's. */
  ratings?: Ratings | HardcoverRatings;
  /** Set a rating. Without it the stars stay a read-out. */
  onRate?: (book: LibraryBook, rating: number) => void;
  /** Whether this book's stars are a control — see BookGrid (ADR 0014). */
  ratable?: (book: LibraryBook) => boolean;
  /** The library-owned vertical scrollport. Without it, render the complete small sample. */
  scrollElement?: HTMLElement | null;
  className?: string;
}

interface TableBookRow {
  kind: "book";
  key: string;
  book: LibraryBook;
}

interface TableHeadingRow {
  kind: "heading";
  key: string;
  label: string;
  count: number;
}

type TableRow = TableBookRow | TableHeadingRow;

/** Calibre dates are ISO 8601; show the day, in the reader's locale. */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

const TH =
  "bg-background/95 text-muted-foreground sticky top-0 z-10 border-line border-b px-3 py-2 text-left text-[10px] font-semibold tracking-[0.08em] uppercase backdrop-blur";

/** The dense view: one row per book, columns fixed until a column picker exists. */
export function BookTable({
  sections,
  onOpen,
  ratings,
  onRate,
  ratable,
  scrollElement,
  className,
}: BookTableProps) {
  // See BookGrid: null is the ref's pre-mount state, while undefined opts a
  // standalone story out of virtualization.
  const virtual = scrollElement !== undefined;
  const rows = useMemo(() => tableRows(sections), [sections]);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const scrollMargin = useVirtualScrollMargin(bodyRef, scrollElement ?? null);
  const virtualizer = useVirtualizer<HTMLElement, HTMLTableRowElement>({
    count: rows.length,
    getScrollElement: () => scrollElement ?? null,
    getItemKey: (index) => rows[index]?.key ?? index,
    estimateSize: (index) => (rows[index]?.kind === "heading" ? 37 : 54),
    overscan: 8,
    scrollMargin,
    enabled: virtual,
    useFlushSync: false,
  });
  const visibleRows = virtual
    ? virtualizer.getVirtualItems()
    : rows.map((row, index) => ({ index, key: row.key, start: 0, end: 0 }));
  const first = visibleRows[0];
  const last = visibleRows[visibleRows.length - 1];
  const paddingTop = virtual && first ? first.start - scrollMargin : 0;
  const paddingBottom =
    virtual && last ? virtualizer.getTotalSize() - (last.end - scrollMargin) : 0;

  return (
    <table
      className={cn("w-full min-w-[960px] table-fixed border-collapse text-[13px]", className)}
    >
      {/* Virtual rows come and go as the shelf scrolls. Fixed tracks keep the
          browser from sizing columns from whichever subset happens to be
          mounted; title alone absorbs the remaining table width. */}
      <colgroup>
        <col className="w-[52px]" />
        <col />
        <col className="w-[190px]" />
        <col className="w-[170px]" />
        <col className="w-[112px]" />
        <col className="w-[120px]" />
        <col className="w-[110px]" />
        <col className="w-[52px]" />
      </colgroup>
      <thead>
        <tr>
          <th className={cn(TH, "w-10")}>
            <span className="sr-only">Cover</span>
          </th>
          <th className={TH}>Title</th>
          <th className={TH}>Author</th>
          <th className={TH}>Series</th>
          <th className={TH}>Rating</th>
          <th className={TH}>Formats</th>
          <th className={TH}>Added</th>
          <th className={cn(TH, "w-12")}>
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody ref={bodyRef}>
        {paddingTop > 0 && <TableSpacer height={paddingTop} />}
        {visibleRows.map((virtualRow) => {
          const row = rows[virtualRow.index];
          if (!row) return null;
          return row.kind === "heading" ? (
            <tr
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtual ? virtualizer.measureElement : undefined}
            >
              {/* One cell across every column — under the sticky header, so it
                  scrolls with its own books rather than fighting it. */}
              <td colSpan={8} className="px-3 pt-4 pb-1.5">
                <span className="flex items-center gap-3">
                  <h2 className="text-foreground/80 text-[11px] font-semibold tracking-[0.08em] uppercase">
                    {row.label}
                  </h2>
                  <span className="text-muted-foreground text-[10px] tabular-nums">
                    {row.count}
                  </span>
                  <span aria-hidden="true" className="border-line flex-1 border-t" />
                </span>
              </td>
            </tr>
          ) : (
            <BookRow
              key={virtualRow.key}
              index={virtualRow.index}
              measure={virtual ? virtualizer.measureElement : undefined}
              book={row.book}
              ratings={ratings}
              onRate={onRate}
              ratable={ratable}
              onOpen={onOpen}
            />
          );
        })}
        {paddingBottom > 0 && <TableSpacer height={paddingBottom} />}
      </tbody>
    </table>
  );
}

interface BookRowProps extends Omit<BookTableProps, "sections" | "scrollElement" | "className"> {
  book: LibraryBook;
  index: number;
  measure?: RefCallback<HTMLTableRowElement>;
}

function BookRow({ book, index, measure, onOpen, ratings, onRate, ratable }: BookRowProps) {
  return (
    <tr
      ref={measure}
      data-index={index}
      onClick={onOpen ? () => onOpen(book) : undefined}
      // A row opens like a card does, so it has to be reachable like one: Tab
      // lands on it, Enter or Space opens it (docs/features/book-list.md).
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={
        onOpen
          ? (event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onOpen(book);
            }
          : undefined
      }
      className={cn(
        "group/book border-line/60 hover:bg-fill border-b transition-colors",
        onOpen &&
          "focus-visible:bg-fill focus-visible:ring-ring cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset",
      )}
    >
      <td className="py-1.5 pr-3 pl-3">
        <BookCover book={book} width={28} className="w-7 rounded-[3px]" />
      </td>
      <td className="text-foreground overflow-hidden px-3 py-1.5 font-medium">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{book.title}</span>
          {/* Beside the title rather than over the thumbnail: a 28px
                    cover has no corner to put a mark in. */}
          <BookMarks book={book} className="shrink-0" />
        </span>
      </td>
      <td className="text-muted-foreground truncate px-3 py-1.5">
        {book.authors.length > 0 ? book.authors.join(", ") : "—"}
      </td>
      <td className="text-muted-foreground truncate px-3 py-1.5">
        {book.series ? (
          <>
            {book.series}
            {book.seriesIndex !== null && (
              <span className="text-muted-foreground/60"> #{book.seriesIndex}</span>
            )}
          </>
        ) : (
          "—"
        )}
      </td>
      {/* The stars stop their own clicks reaching the row, so rating a
                book never also opens it. */}
      <td className="px-3 py-1.5">
        {onRate && (ratable?.(book) ?? true) ? (
          <StarRating
            value={bookRating(book, ratings)}
            onRate={(rating) => onRate(book, rating)}
            label={book.title}
          />
        ) : bookRating(book, ratings) > 0 ? (
          <StarRating value={bookRating(book, ratings)} />
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
      </td>
      <td className="overflow-hidden px-3 py-1.5">
        <span className="flex gap-1 overflow-hidden">
          {book.formats.length === 0 && <span className="text-muted-foreground/50">—</span>}
          {book.formats.map((format) => (
            <span
              key={format}
              className="border-line bg-fill text-muted-foreground rounded border px-1 py-px text-[9px] font-semibold tracking-wide"
            >
              {format}
            </span>
          ))}
        </span>
      </td>
      <td className="text-muted-foreground px-3 py-1.5 text-xs whitespace-nowrap tabular-nums">
        {formatDate(book.added)}
      </td>
      {/* Always this wide, empty or not, so rows don't shift as the pointer moves down. */}
      <td className="w-12 px-3 py-1.5">
        <BookDownloadButton book={book} className="size-6 rounded-md" />
      </td>
    </tr>
  );
}

function TableSpacer({ height }: { height: number }) {
  return (
    // biome-ignore lint/a11y/noAriaHiddenOnFocusable: this empty sizing row has no focusable descendants.
    <tr aria-hidden="true">
      <td colSpan={8} className="border-0 p-0" style={{ height }} />
    </tr>
  );
}

function tableRows(sections: BookSection[]): TableRow[] {
  const rows: TableRow[] = [];
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
    for (const book of section.books) {
      rows.push({ kind: "book", key: `book:${book.id}`, book });
    }
  }
  return rows;
}

/** Placeholder rows in the table's own shape. */
export function BookTableSkeleton({ count = 14 }: { count?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder rows, never reordered
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-7 rounded-[3px]" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-1/5" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}
