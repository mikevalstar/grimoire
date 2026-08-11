import { BookGrid, BookGridSkeleton } from "@/components/book-grid";
import { BookTable, BookTableSkeleton } from "@/components/book-table";
import { LibraryToolbar } from "@/components/library-toolbar";
import { Button } from "@/components/ui/button";
import { ApiError, type LibraryBook } from "@/lib/api";
import { useViewMode } from "@/lib/view-mode";

export interface BookLibraryProps {
  books?: LibraryBook[];
  /** The library is still on its way — draw the active view's skeleton. */
  isPending?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

/**
 * The library screen: the toolbar, and under it the books in whichever view is
 * chosen. Owns the scroll region so the table's header can stick to the top of
 * it. See docs/features/book-list.md.
 */
export function BookLibrary({ books, isPending, error, onRetry }: BookLibraryProps) {
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
          <BookGrid books={books} />
        ) : (
          <BookTable books={books} />
        )}
      </div>
    </div>
  );
}

/** The content server answered, with nothing in it. */
function LibraryEmpty() {
  return (
    <div className="py-24 text-center">
      <p className="text-foreground text-sm">This library has no books in it.</p>
      <p className="text-muted-foreground mt-1 text-[13px]">
        Add them in Calibre — Grimoire reads whatever the content server is serving.
      </p>
    </div>
  );
}

/** Usually the content server being down, which the proxy explains in its hint. */
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
