import { fold } from "@grimoire/core/matching";
import { useMemo, useState } from "react";
import { BookDetailsPanel, type HardcoverContentProps } from "@/components/book-details-panel";
import { BookGrid, BookGridSkeleton } from "@/components/book-grid";
import { BookTable, BookTableSkeleton } from "@/components/book-table";
import { GroupMenu, SortMenu } from "@/components/library-order-menus";
import { LibraryQuickFilter } from "@/components/library-quick-filter";
import {
  LibrarySourceFilter,
  librarySources,
  matchesSourceFilter,
} from "@/components/library-source-filter";
import { LibraryToolbar } from "@/components/library-toolbar";
import { ReadStatusFilter, type ReadStatusFilterValue } from "@/components/read-status-filter";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  bookRating,
  type HardcoverRatings,
  type LibraryBook,
  type Ratings,
} from "@/lib/api";
import {
  describeFilter,
  type FilterField,
  filterTerm,
  matchesFilterTerms,
  type ParsedFilter,
  parseFilterQuery,
} from "@/lib/book-filter";
import { rankBooks, searchBooks } from "@/lib/book-search";
import { orderLibrary, READER_GROUP_KEYS, useLibraryOrder } from "@/lib/library-order";
import { LIBRARY_VIEW_DEFAULTS, type LibraryView, type SetLibraryView } from "@/lib/library-view";
import { setOpenBookId, useOpenBookId } from "@/lib/open-book";
import { useDuplicates } from "@/lib/queries";
import { useViewMode } from "@/lib/view-mode";

export interface BookLibraryProps {
  books?: LibraryBook[];
  /**
   * How the shelf is narrowed and ordered. Supplied by the route, which keeps
   * it in the URL (ADR 0020) — omit both this and `onShelfChange` and the
   * screen holds its own, which is what a story wants.
   */
  shelf?: LibraryView;
  onShelfChange?: SetLibraryView;
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
  /**
   * When the reader finished a book, for read-year grouping
   * (docs/features/library-sort-and-group.md). Same source as `isRead`.
   */
  finishedAt?: (book: LibraryBook) => string | null;
  onToggleRead?: (book: LibraryBook, read: boolean) => void;
  /** Known finish dates for the book currently open in the details panel. */
  openBookReadDates?: string[];
  readDatesPending?: boolean;
  readDatesError?: Error | null;
  /**
   * Show a different one of a work's covers, by member id — the details panel's
   * cover stack (docs/features/book-details-panel.md).
   */
  onChooseCover?: (book: LibraryBook, bookId: number) => void;
  /**
   * Fetch the open book's covers again, overwriting them — the details panel's
   * actions menu (docs/features/book-actions.md).
   */
  onRefetchCover?: (book: LibraryBook) => Promise<{ attempted: number; fetched: number }>;
  /**
   * Open the set-series dialog for the book whose panel is open
   * (docs/features/setting-a-series-from-hardcover.md).
   */
  onSetSeries?: (book: LibraryBook) => void;
  /** Promote one of the open book's series to the head of its line. */
  onChoosePrimarySeries?: (book: LibraryBook, seriesId: number) => void;
  /**
   * Hardcover's about, tags and moods for the open book, where the instance
   * asked for them (docs/features/book-details-panel.md). The panel falls back
   * to Calibre's for anything missing.
   */
  openBookHardcover?: HardcoverContentProps;
}

/**
 * The library screen: the toolbar, and under it the books in whichever view is
 * chosen. Owns the scroll region so the table's header can stick to the top of
 * it, and the details panel a click on any book opens.
 * See docs/features/book-list.md and docs/features/book-details-panel.md.
 */
export function BookLibrary({
  books,
  shelf: shelfProp,
  onShelfChange,
  isPending,
  error,
  onRetry,
  ratings,
  onRate,
  ratable,
  isRead,
  finishedAt,
  onToggleRead,
  openBookReadDates,
  readDatesPending,
  readDatesError,
  onChooseCover,
  onRefetchCover,
  onSetSeries,
  onChoosePrimarySeries,
  openBookHardcover,
}: BookLibraryProps) {
  const [view, setView] = useViewMode();
  const [storedOrder] = useLibraryOrder();
  // Uncontrolled — a story, or any surface with no URL to write to. Seeded
  // from this device's stored order so it opens the way the app would.
  const [ownShelf, setOwnShelf] = useState<LibraryView>(() => ({
    ...LIBRARY_VIEW_DEFAULTS,
    ...storedOrder,
  }));
  const shelf = shelfProp ?? ownShelf;
  const changeShelf: SetLibraryView =
    onShelfChange ?? (({ patch }) => setOwnShelf((current) => ({ ...current, ...patch })));
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);

  const order = useMemo(
    () => ({ sort: shelf.sort, dir: shelf.dir, group: shelf.group }),
    [shelf.sort, shelf.dir, shelf.group],
  );

  // The filter box holds both field terms and free text
  // (docs/features/library-quick-filter.md). Terms narrow first — they are
  // exact and cheap — and the ranked search then runs over what is left.
  const parsed = useMemo(() => parseFilterQuery(shelf.q), [shelf.q]);
  const termedBooks = useMemo(() => {
    if (!parsed.hasTerms) return books ?? [];
    return (books ?? []).filter((book) => matchesFilterTerms(book, parsed));
  }, [books, parsed]);

  // A query ranks every matching book. Keep the score beside the filtered
  // list so the chosen library sort can break relevance ties.
  const ranked = useMemo(
    () => (fold(parsed.text) ? rankBooks(termedBooks, parsed.text) : null),
    [termedBooks, parsed.text],
  );
  const searchedBooks = useMemo(
    () => ranked?.map((entry) => entry.book) ?? termedBooks,
    [termedBooks, ranked],
  );

  // Clicking an author or a series replaces the whole query rather than adding
  // to it: it is a jump to a different shelf, not a refinement of this one, and
  // it earns a history entry so the back button undoes it.
  const filterBy = (field: FilterField, value: string) => {
    changeShelf({ patch: { q: filterTerm(field, value) }, push: true });
  };

  // The toolbar filters in a fixed order — text, then source, then read status —
  // so each control's counts describe what the ones before it left
  // (docs/features/library-source-filter.md).
  const sources = useMemo(() => librarySources(books), [books]);
  const sourcedBooks = useMemo(
    () =>
      shelf.sources.length === 0
        ? searchedBooks
        : searchedBooks.filter((book) => matchesSourceFilter(book, shelf.sources)),
    [searchedBooks, shelf.sources],
  );

  const effectiveReadFilter = isRead ? shelf.read : "all";
  const readStatusCounts = useMemo(
    () => ({
      all: sourcedBooks.length,
      "to-read": isRead ? sourcedBooks.filter((book) => !isRead(book)).length : 0,
      read: isRead ? sourcedBooks.filter(isRead).length : 0,
    }),
    [sourcedBooks, isRead],
  );
  const shownBooks = useMemo(() => {
    if (!isRead || effectiveReadFilter === "all") return sourcedBooks;
    return sourcedBooks.filter((book) => isRead(book) === (effectiveReadFilter === "read"));
  }, [sourcedBooks, isRead, effectiveReadFilter]);
  const relevance = useMemo(
    () => (ranked ? new Map(ranked.map((entry) => [entry.book.id, entry.score])) : null),
    [ranked],
  );

  // A grouping stored from a session with a reader would file the whole
  // library under one meaningless section once nobody is chosen, so it lapses
  // back to ungrouped rather than lying.
  const effectiveOrder = useMemo(
    () =>
      READER_GROUP_KEYS.has(order.group) && !isRead ? { ...order, group: "none" as const } : order,
    [order, isRead],
  );
  // The shelf as held: sorted, and split into sections when grouped
  // (docs/features/library-sort-and-group.md). Rating and read state are
  // per-reader, so the order recomputes when either map changes hands.
  const sections = useMemo(
    () =>
      orderLibrary(shownBooks, effectiveOrder, {
        rating: (book) => bookRating(book, ratings),
        isRead,
        finishedAt,
        relevance: relevance ? (book) => relevance.get(book.id) ?? 0 : undefined,
      }),
    [shownBooks, effectiveOrder, ratings, isRead, finishedAt, relevance],
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
        view={view}
        onViewChange={setView}
        statusFilter={
          <ReadStatusFilter
            value={effectiveReadFilter}
            onValueChange={(read) => changeShelf({ patch: { read }, push: true })}
            counts={books && !error ? readStatusCounts : undefined}
            disabled={!isRead}
          />
        }
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* Typing replaces the history entry — one back step per keystroke
              would make the back button useless (ADR 0020). */}
          <LibraryQuickFilter value={shelf.q} onChange={(q) => changeShelf({ patch: { q } })} />
          {/* Absent, not disabled, in a single-source library. */}
          <LibrarySourceFilter
            sources={sources}
            value={shelf.sources}
            onValueChange={(next) => changeShelf({ patch: { sources: next }, push: true })}
          />
          <SortMenu order={order} onOrder={(next) => changeShelf({ patch: next, push: true })} />
          {/* The read-state groupings mean nothing until someone's marks exist. */}
          <GroupMenu
            order={order}
            onOrder={(next) => changeShelf({ patch: next, push: true })}
            readerAvailable={isRead !== undefined}
          />
        </div>
      </LibraryToolbar>

      {/* A hovered card spills outside its own box — a 2px ring and the indigo
          glow — and the scroll box clips anything past its edge, which shaved
          the outermost column. So the region takes the shell's horizontal
          padding itself and gives it back with a matching negative margin:
          books sit exactly where they did, but now with room inside the
          scroller for the hover to bleed into. */}
      <div
        ref={setScrollElement}
        className="-mx-3 min-h-0 flex-1 scroll-smooth overflow-auto px-3 pt-5 motion-reduce:scroll-auto sm:-mx-5 sm:px-5"
      >
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
        ) : shownBooks.length === 0 ? (
          <LibraryNoMatches
            filter={parsed}
            readFilter={effectiveReadFilter}
            sourceFiltered={shelf.sources.length > 0}
          />
        ) : view === "covers" ? (
          <BookGrid
            sections={sections}
            scrollElement={scrollElement}
            ratings={ratings}
            onRate={onRate}
            ratable={ratable}
            isRead={isRead}
            onToggleRead={onToggleRead}
            onFilter={filterBy}
            onOpen={(book) => setOpenBookId(book.id)}
          />
        ) : (
          <BookTable
            sections={sections}
            scrollElement={scrollElement}
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
        // Always offered for a book that is open: which of its *members* have a
        // source to ask is server-side knowledge, and the run says so when the
        // answer is none (docs/features/book-actions.md).
        onRefetchCover={onRefetchCover && openBook ? () => onRefetchCover(openBook) : undefined}
        onSetSeries={onSetSeries && openBook ? () => onSetSeries(openBook) : undefined}
        onChoosePrimarySeries={
          onChoosePrimarySeries && openBook
            ? (seriesId) => onChoosePrimarySeries(openBook, seriesId)
            : undefined
        }
        // Filtering from the panel closes it: the click asked to see the
        // shelf, and leaving the flyout over the answer hides it.
        onFilter={(field, value) => {
          setOpenBookId(null);
          filterBy(field, value);
        }}
        readDates={openBookReadDates}
        readDatesPending={readDatesPending}
        readDatesError={readDatesError}
        hardcover={openBookHardcover}
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

/** A real library, but nothing satisfying every active filter. */
function LibraryNoMatches({
  filter,
  readFilter,
  sourceFiltered,
}: {
  filter: ParsedFilter;
  readFilter: ReadStatusFilterValue;
  sourceFiltered: boolean;
}) {
  const status = readFilter === "read" ? "read" : readFilter === "to-read" ? "to read" : null;
  const marked = status ? `marked ${status} ` : "";
  const where = sourceFiltered ? " in the selected sources" : "";
  // The terms as they were understood, rather than the raw query — a filter
  // that parsed differently from how it was typed should say so.
  const described = describeFilter(filter);
  let reason: string;
  if (described.length > 0) {
    reason = `Nothing ${marked}matched ${described.join(" and ")}${where}.`;
  } else if (status) {
    reason = `There are no books marked ${status}${where}.`;
  } else {
    reason = "There are no books from the selected sources.";
  }
  return (
    <div className="py-24 text-center">
      <p className="text-foreground text-sm">No matching books.</p>
      <p className="text-muted-foreground mt-1 text-[13px]">{reason} Try a different filter.</p>
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
