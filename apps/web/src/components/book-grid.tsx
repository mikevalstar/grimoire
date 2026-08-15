import { BookCover } from "@/components/book-cover";
import { BookDownloadButton } from "@/components/book-download-button";
import { BookMarks } from "@/components/book-marks";
import { ReadCorner } from "@/components/read-corner";
import { StarRating } from "@/components/star-rating";
import { Skeleton } from "@/components/ui/skeleton";
import { bookRating, type HardcoverRatings, type LibraryBook, type Ratings } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface BookGridProps {
  books: LibraryBook[];
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
  className?: string;
}

/** The shelf: covers first, metadata under them, reflowing to any width. */
export function BookGrid({
  books,
  onOpen,
  ratings,
  onRate,
  ratable,
  isRead,
  onToggleRead,
  className,
}: BookGridProps) {
  return (
    <ul className={cn(GRID, className)}>
      {books.map((book) => {
        const cover = (
          <BookCover
            book={book}
            width={180}
            // Hovered, a cover casts a deeper shadow *and* an indigo glow under
            // it, with the ring at full strength — the same pairing the design
            // uses for a focused card, because a hover that only deepens a grey
            // shadow reads as nothing at all on a dark canvas.
            className="group-hover/book:ring-you/70 shadow-[0_8px_20px_-10px_rgba(0,0,0,0.8)] transition-shadow duration-300 group-hover/book:shadow-[0_18px_36px_-12px_rgba(0,0,0,0.9),0_10px_30px_-8px_var(--you-glow)] group-hover/book:ring-2"
          />
        );

        return (
          // The lift belongs to the whole card, so the download button rides
          // along with the cover instead of sliding under the pointer.
          // A column, so the stars can be pinned to the bottom of every card.
          <li key={book.id} className="group/book flex min-w-0 flex-col">
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
            <p className="text-muted-foreground min-h-[1lh] truncate text-[11px]">
              {book.authors.join(", ")}
            </p>
            <p className="text-muted-foreground/70 min-h-[1lh] truncate text-[11px]">
              {book.series && (
                <>
                  {book.series}
                  {book.seriesIndex !== null && ` #${book.seriesIndex}`}
                </>
              )}
            </p>
            {/* Pinned to the bottom, so a card whose cover comes back a little
                taller doesn't push its stars out of line with the rest of the
                row. */}
            <StarRating
              value={bookRating(book, ratings)}
              onRate={
                onRate && (ratable?.(book) ?? true) ? (rating) => onRate(book, rating) : undefined
              }
              label={book.title}
              className="mt-auto pt-1"
            />
          </li>
        );
      })}
    </ul>
  );
}

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
