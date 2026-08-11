import { BookCover } from "@/components/book-cover";
import { StarRating } from "@/components/star-rating";
import { Skeleton } from "@/components/ui/skeleton";
import type { LibraryBook } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface BookGridProps {
  books: LibraryBook[];
  /**
   * Opening a book. Cards are only clickable when this is given — there is no
   * detail panel yet, and a hover affordance that leads nowhere is a lie.
   */
  onOpen?: (book: LibraryBook) => void;
  className?: string;
}

/** The shelf: covers first, metadata under them, reflowing to any width. */
export function BookGrid({ books, onOpen, className }: BookGridProps) {
  return (
    <ul className={cn(GRID, className)}>
      {books.map((book) => {
        const card = (
          <>
            <BookCover
              book={book}
              width={180}
              className={
                onOpen
                  ? "transition-transform duration-300 ease-spring group-hover:-translate-y-1"
                  : undefined
              }
            />
            <p className="text-foreground mt-2 line-clamp-2 text-[13px] leading-snug font-medium">
              {book.title}
            </p>
            {book.authors.length > 0 && (
              <p className="text-muted-foreground truncate text-[11px]">
                {book.authors.join(", ")}
              </p>
            )}
            {book.series && (
              <p className="text-muted-foreground/70 truncate text-[11px]">
                {book.series}
                {book.seriesIndex !== null && ` #${book.seriesIndex}`}
              </p>
            )}
            <StarRating value={book.rating} className="mt-1" />
          </>
        );

        return (
          <li key={book.id} className="group min-w-0">
            {onOpen ? (
              <button
                type="button"
                onClick={() => onOpen(book)}
                className="focus-visible:ring-ring/50 block w-full rounded-md text-left focus-visible:ring-[3px] focus-visible:outline-none"
              >
                {card}
              </button>
            ) : (
              card
            )}
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
