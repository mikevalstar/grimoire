import { useMemo } from "react";
import { BookDetailsPanel } from "@/components/book-details-panel";
import { BookGrid, BookGridSkeleton } from "@/components/book-grid";
import { BookTable, BookTableSkeleton } from "@/components/book-table";
import { GroupMenu, SortMenu } from "@/components/library-order-menus";
import { LibraryToolbar } from "@/components/library-toolbar";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  bookRating,
  type HardcoverRatings,
  type LibraryBook,
  type Ratings,
} from "@/lib/api";
import { searchBooks } from "@/lib/book-search";
import { orderLibrary, useLibraryOrder } from "@/lib/library-order";
import { setOpenBookId, useOpenBookId } from "@/lib/open-book";
import { useDuplicates } from "@/lib/queries";
import { useViewMode } from "@/lib/view-mode";

export interface BookLibraryProps {
  books?: LibraryBook[];
  /** The library is still on its way — draw the active view's skeleton. */
  isPending?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  /** The current reader's ratings, from whichever source they chose (ADR 0014). */
  ratings?: Ratings | HardcoverRatings;
  /** Set a rating. Without it the stars stay a read-out. */
  onRate?: (book: LibraryBook, rating: number) => void;
  /** Whether this book's stars are a control — see BookGrid (ADR 0014). */
  ratable?: (book: LibraryBook) => boolean;
  /** The dog-ear (docs/features/marking-a-book-read.md) — see BookGrid. */
  isRead?: (book: LibraryBook) => boolean;
  onToggleRead?: (book: LibraryBook, read: boolean) => void;
  /**
   * Show a different one of a work's covers, by member id — the details panel's
   * cover stack (docs/features/book-details-panel.md).
   */
  onChooseCover?: (book: LibraryBook, bookId: number) => void;
}

/**
 * The library screen: the toolbar, and under it the books in whichever view is
 * chosen. Owns the scroll region so the table's header can stick to the top of
 * it, and the details panel a click on any book opens.
 * See docs/features/book-list.md and docs/features/book-details-panel.md.
 */
export function BookLibrary({
  books,
  isPending,
  error,
  onRetry,
  ratings,
  onRate,
  ratable,
  isRead,
  onToggleRead,
  onChooseCover,
}: BookLibraryProps) {
  const [view, setView] = useViewMode();
  const [order, setOrder] = useLibraryOrder();

  // The shelf as held: sorted, and split into sections when grouped
  // (docs/features/library-sort-and-group.md). Rating and read state are
  // per-reader, so the order recomputes when either map changes hands.
  const sections = useMemo(
    () =>
      orderLibrary(books ?? [], order, {
        rating: (book) => bookRating(book, ratings),
        isRead,
      }),
    [books, order, ratings, isRead],
  );

  // Which book the details panel is showing, by id rather than by value, so a
  // refetch behind the panel updates it instead of pinning a stale copy — and
  // so a book that leaves the library takes its panel with it. The id lives in
  // a global store (lib/open-book.ts) so the command palette can open a book
  // from the shell.
  const openId = useOpenBookId();
  const openBook = books?.find((book) => book.id === openId) ?? null;

  // Duplicate resolution is about the book that is open, so it is fetched here
  // rather than by the route — and follows the reader through a merge, since
  // the surviving work is the older of the two
  // (docs/features/resolving-duplicates.md).
  const { duplicates, ...sameBook } = useDuplicates(openId, (book) => setOpenBookId(book.id));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <LibraryToolbar
        bookCount={error ? undefined : books?.length}
        view={view}
        onViewChange={setView}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <SortMenu order={order} onOrder={setOrder} />
          {/* Read-status grouping means nothing until someone's marks exist. */}
          <GroupMenu order={order} onOrder={setOrder} readStatusAvailable={isRead !== undefined} />
        </div>
      </LibraryToolbar>

      {/* A hovered card spills outside its own box — a 2px ring and the indigo
          glow — and the scroll box clips anything past its edge, which shaved
          the outermost column. So the region takes the shell's horizontal
          padding itself and gives it back with a matching negative margin:
          books sit exactly where they did, but now with room inside the
          scroller for the hover to bleed into. */}
      <div className="-mx-3 min-h-0 flex-1 overflow-auto px-3 pt-4 sm:-mx-5 sm:px-5">
        {error ? (
          <LibraryError error={error} onRetry={onRetry} />
        ) : isPending || !books ? (
          view === "covers" ? (
            <BookGridSkeleton />
          ) : (
            <BookTableSkeleton />
          )
        ) : books.length === 0 ? (
          <LibraryEmpty />
        ) : view === "covers" ? (
          <BookGrid
            sections={sections}
            ratings={ratings}
            onRate={onRate}
            ratable={ratable}
            isRead={isRead}
            onToggleRead={onToggleRead}
            onOpen={(book) => setOpenBookId(book.id)}
          />
        ) : (
          <BookTable
            sections={sections}
            ratings={ratings}
            onRate={onRate}
            ratable={ratable}
            onOpen={(book) => setOpenBookId(book.id)}
          />
        )}
      </div>

      <BookDetailsPanel
        book={openBook}
        onClose={() => setOpenBookId(null)}
        rating={openBook ? bookRating(openBook, ratings) : 0}
        onRate={
          onRate && openBook && (ratable?.(openBook) ?? true)
            ? (rating) => onRate(openBook, rating)
            : undefined
        }
        onChooseCover={
          onChooseCover && openBook ? (bookId) => onChooseCover(openBook, bookId) : undefined
        }
        sameBook={{
          duplicates,
          // A candidate names a work; the shelf already holds every one — which
          // is also what the manual picker searches, in the browser
          // (docs/features/resolving-duplicates.md).
          bookFor: (workId) => books?.find((book) => book.id === workId),
          search: (query) => searchBooks(books ?? [], query, { exclude: openId ?? undefined }),
          ...sameBook,
        }}
      />
    </div>
  );
}

/**
 * Nothing in `books` yet — either Calibre's library really is empty, or the
 * first sync hasn't finished. Both are worth naming, since the second is the
 * common one on a fresh install and resolves itself.
 */
function LibraryEmpty() {
  return (
    <div className="py-24 text-center">
      <p className="text-foreground text-sm">No books here yet.</p>
      <p className="text-muted-foreground mt-1 text-[13px]">
        If you've just connected Calibre, the first sync is probably still running. Otherwise, add
        books in Calibre — Grimoire syncs whatever the content server is serving.
      </p>
    </div>
  );
}

/** Grimoire's own database failing, now — a content server that's down is the sync's problem. */
function LibraryError({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-24 text-center">
      <p className="text-foreground text-sm">Couldn't load the library.</p>
      <p className="text-muted-foreground mt-1 text-[13px]">{error.message}</p>
      {error instanceof ApiError && error.hint && (
        <p className="text-muted-foreground/70 mt-2 text-[12px]">{error.hint}</p>
      )}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
          Try again
        </Button>
      )}
    </div>
  );
}
