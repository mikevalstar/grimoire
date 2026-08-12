import { BookGrid, BookGridSkeleton } from "@/components/book-grid";
import { BookTable, BookTableSkeleton } from "@/components/book-table";
import { LibraryToolbar } from "@/components/library-toolbar";
import { Button } from "@/components/ui/button";
import { ApiError, type LibraryBook, type Ratings } from "@/lib/api";
import { useViewMode } from "@/lib/view-mode";

export interface BookLibraryProps {
  books?: LibraryBook[];
  /** The library is still on its way — draw the active view's skeleton. */
  isPending?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  /** The current reader's ratings, shown in front of Calibre's. */
  ratings?: Ratings;
  /** Set a rating. Without it the stars stay a read-out. */
  onRate?: (book: LibraryBook, rating: number) => void;
}

/**
 * The library screen: the toolbar, and under it the books in whichever view is
 * chosen. Owns the scroll region so the table's header can stick to the top of
 * it. See docs/features/book-list.md.
 */
export function BookLibrary({
  books,
  isPending,
  error,
  onRetry,
  ratings,
  onRate,
}: BookLibraryProps) {
  const [view, setView] = useViewMode();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <LibraryToolbar
        bookCount={error ? undefined : books?.length}
        view={view}
        onViewChange={setView}
      />

      <div className="min-h-0 flex-1 overflow-auto pt-4">
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
          <BookGrid books={books} ratings={ratings} onRate={onRate} />
        ) : (
          <BookTable books={books} ratings={ratings} onRate={onRate} />
        )}
      </div>
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
