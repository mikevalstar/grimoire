import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { BookLibrary } from "@/components/book-library";
import { HardcoverFindDialog, type PendingFind } from "@/components/hardcover-find-dialog";
import { HardcoverShelveDialog, type PendingShelve } from "@/components/hardcover-shelve-dialog";
import { type PendingReadState, ReadStateDialog } from "@/components/read-state-dialog";
import { SetSeriesDialog } from "@/components/set-series-dialog";
import {
  BOOK_SOURCE,
  bookFinishedAt,
  bookIsRead,
  bookRating,
  fetchSeriesRoster,
  hardcoverContentPrefs,
  type LibraryBook,
  searchHardcover,
} from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";
import { setLibraryOrder, useLibraryOrder } from "@/lib/library-order";
import {
  type LibraryView,
  librarySearchSchema,
  libraryViewFromSearch,
  libraryViewToSearch,
  type SetLibraryView,
  touchesOrder,
} from "@/lib/library-view";
import { useOpenBookId } from "@/lib/open-book";
import {
  booksQuery,
  hardcoverContentQuery,
  hardcoverRatingsQuery,
  hardcoverReadDatesQuery,
  hardcoverSeriesQuery,
  preferencesQuery,
  ratingsQuery,
  readStatesQuery,
  useApplySeries,
  useChooseCover,
  useRateBook,
  useRefetchCover,
  useSetPrimarySeries,
  useSetReadState,
} from "@/lib/queries";

export const Route = createFileRoute("/")({
  // How the shelf is narrowed and ordered, so any view of it is a link
  // (ADR 0020). Every field catches, so a hand-edited URL degrades to the
  // default rather than erroring the route.
  validateSearch: librarySearchSchema,
  // Prefetch, but don't fail the route on it: a content server that's down is
  // a state the screen draws (with the proxy's hint), not a router error.
  loader: ({ context }) => context.queryClient.ensureQueryData(booksQuery).catch(() => undefined),
  component: LibraryScreen,
});

/**
 * The URL, read as a view of the library and written back the same way. Sort,
 * direction and group fall back to this device's stored order for a URL that
 * doesn't name them, and are written as a set once anything moves them — see
 * `libraryViewToSearch`.
 */
function useLibraryView(): [LibraryView, SetLibraryView] {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [storedOrder] = useLibraryOrder();

  const view = libraryViewFromSearch(search, storedOrder);
  // The URL already names the order, or this change is about to.
  const ordered =
    search.sort !== undefined || search.dir !== undefined || search.group !== undefined;

  const setView: SetLibraryView = ({ patch, push }) => {
    const next = { ...view, ...patch };
    // Keep the per-device mirror in step, so the *next* bare visit opens the
    // way this one was left.
    if (touchesOrder(patch)) setLibraryOrder({ sort: next.sort, dir: next.dir, group: next.group });
    void navigate({
      search: libraryViewToSearch(next, ordered || touchesOrder(patch)),
      replace: !push,
    });
  };

  return [view, setView];
}

function LibraryScreen() {
  const { data: books, error, isPending, refetch } = useQuery(booksQuery);
  const [shelf, setShelf] = useLibraryView();

  // Ratings and read state belong to whoever is using this device, each from
  // whichever source they chose (ADR 0014,
  // docs/features/marking-a-book-read.md), and follow them when any of that
  // changes. Both sources default to Hardcover but only live there for a
  // linked reader.
  const currentUser = useCurrentUser();
  const source =
    currentUser?.hardcoverUsername && currentUser.ratingsSource === "hardcover"
      ? "hardcover"
      : "local";
  const readSource =
    currentUser?.hardcoverUsername && currentUser.readStateSource === "hardcover"
      ? "hardcover"
      : "local";

  // Only the maps somebody displays are fetched — an unused query gets no
  // reader and stays idle. The Hardcover map serves both stars and corners.
  const { data: localRatings } = useQuery(
    ratingsQuery(source === "local" ? currentUser?.id : null),
  );
  const { data: hardcoverRatings } = useQuery(
    hardcoverRatingsQuery(
      source === "hardcover" || readSource === "hardcover" ? currentUser?.id : null,
    ),
  );
  const { data: readStates } = useQuery(
    readStatesQuery(readSource === "local" ? currentUser?.id : null),
  );
  const ratings = source === "hardcover" ? hardcoverRatings : localRatings;

  // Unlike the shelf mirror, a book's complete reread history is asked for
  // live — and only while that read book's panel is open.
  const openBookId = useOpenBookId();
  const openBook = books?.find((book) => book.id === openBookId);
  const openBookIsRead = Boolean(
    currentUser && openBook && bookIsRead(openBook, readSource, readStates, hardcoverRatings),
  );
  const readDatesQuery = useQuery(
    hardcoverReadDatesQuery(
      readSource === "hardcover" ? currentUser?.id : null,
      openBookId,
      readSource === "hardcover" && openBookIsRead,
    ),
  );
  const localFinishedAt = openBookId == null ? null : readStates?.[String(openBookId)]?.finishedAt;
  const openBookReadDates = !openBookIsRead
    ? []
    : readSource === "hardcover"
      ? readDatesQuery.data?.dates
      : localFinishedAt
        ? [localFinishedAt]
        : [];

  // Which of Hardcover's writing about a book to prefer over Calibre's is one
  // instance-wide answer, not a per-reader one (docs/features/settings.md) —
  // but it is fetched with the reading reader's token, so a reader with no
  // linked account keeps Calibre's whatever the switches say.
  //
  // Asked for every book Hardcover has a side of, whatever the switches and
  // whether or not this reader is linked: the same answer carries the link out
  // to hardcover.app, which is about the match rather than about whose writing
  // wins (docs/features/book-details-panel.md).
  const { data: preferences } = useQuery(preferencesQuery);
  const contentPrefs = hardcoverContentPrefs(preferences);
  const openBookOnHardcover = Boolean(openBook?.sources.includes(BOOK_SOURCE.hardcover));
  const contentQuery = useQuery(
    hardcoverContentQuery(currentUser?.id, openBookId, openBookOnHardcover),
  );
  const content = contentQuery.data;
  const openBookHardcover = {
    about: contentPrefs.about ? content?.about : undefined,
    tags: contentPrefs.tags ? content?.tags : undefined,
    moods: contentPrefs.moods ? content?.moods : undefined,
    url: content?.url,
  };

  const queryClient = useQueryClient();
  const rate = useRateBook(currentUser?.id, source);
  const setReadState = useSetReadState(currentUser?.id, readSource);

  // A rating held back until the reader confirms it may shelve the book on
  // Hardcover as Read (ADR 0014).
  const [pendingShelf, setPendingShelf] = useState<PendingShelve | null>(null);
  // A rating or mark-read held back until the reader finds the book in
  // Hardcover's catalogue — a Calibre-only work has no edition there yet.
  const [pendingFind, setPendingFind] = useState<PendingFind | null>(null);
  // A corner click, held for the always-shown confirm.
  const [pendingRead, setPendingRead] = useState<PendingReadState | null>(null);

  // Statuses where a rating raises the mark-as-read ask: the book isn't done
  // by Hardcover's account. DNF and Ignored are states someone chose — a
  // rating doesn't retract them (docs/features/rating-a-book.md).
  const UNFINISHED_STATUSES = new Set([1, 2, 4]);

  function onRate(book: LibraryBook, rating: number) {
    if (source === "hardcover") {
      const entry = hardcoverRatings?.[String(book.id)];
      // Not on their shelves: adding is the reader's call, not a side effect
      // of a star click. A book Hardcover already knows gets a confirm; a
      // Calibre-only one gets the finder.
      if (!entry) {
        if (rating <= 0) return;
        if (book.sources.includes(BOOK_SOURCE.hardcover)) {
          setPendingShelf({ book, rating, statusId: null });
        } else setPendingFind({ book, rating });
        return;
      }
      // Shelved but not finished — Want to Read, Reading, Paused: ask before
      // the rating quietly implies they read it. Clearing skips the ask.
      if (rating > 0 && UNFINISHED_STATUSES.has(entry.statusId)) {
        setPendingShelf({ book, rating, statusId: entry.statusId });
        return;
      }
    }
    rate.mutate({ bookId: book.id, rating });
  }

  // The corner check: always through the confirm, both directions
  // (docs/features/marking-a-book-read.md). The optional rating is only
  // offered when it would land in the same store as the read state.
  const offerRating = source === readSource;

  function onToggleRead(book: LibraryBook, read: boolean) {
    if (readSource === "hardcover") {
      const entry = hardcoverRatings?.[String(book.id)];
      // Marking a Calibre-only book read means finding it there first.
      if (read && !entry && !book.sources.includes(BOOK_SOURCE.hardcover)) {
        setPendingFind({ book, rating: null });
        return;
      }
      setPendingRead({
        book,
        read,
        shelfState: entry ? "shelved" : "unshelved",
        currentRating: offerRating ? bookRating(book, ratings) : 0,
        offerRating,
      });
      return;
    }
    setPendingRead({
      book,
      read,
      shelfState: null,
      currentRating: offerRating ? bookRating(book, ratings) : 0,
      offerRating,
    });
  }

  // Stable, so the finder's debounced search effect doesn't re-arm per render.
  const userId = currentUser?.id;
  const findSearch = useCallback(
    (query: string) =>
      userId == null
        ? Promise.resolve([])
        : searchHardcover(userId, query).then((found) => found.results),
    [userId],
  );

  // Which cover a work shows is the library's, not a reader's, so this needs
  // nobody to be chosen first (docs/features/book-details-panel.md).
  const chooseCover = useChooseCover();
  // Same reasoning: re-fetching a cover changes what the library looks like,
  // not what a reader thinks of it (docs/features/book-actions.md).
  const refetchCover = useRefetchCover();

  // The book whose series is being set, held while the dialog is open. Its own
  // state rather than the open panel's: the panel stays open behind the dialog,
  // and closing one must not close the other
  // (docs/features/setting-a-series-from-hardcover.md).
  const [settingSeries, setSettingSeries] = useState<LibraryBook | null>(null);
  const seriesOptions = useQuery(
    hardcoverSeriesQuery(currentUser?.id, settingSeries?.id ?? null, null, settingSeries !== null),
  );
  const applySeries = useApplySeries(currentUser?.id);
  // Which series heads a book's line is the library's answer, not a reader's —
  // the same reasoning as the cover choice, so this needs nobody chosen.
  const choosePrimarySeries = useSetPrimarySeries();

  return (
    <>
      <BookLibrary
        books={books}
        shelf={shelf}
        onShelfChange={setShelf}
        isPending={isPending}
        error={error}
        onRetry={() => void refetch()}
        ratings={ratings}
        // No reader chosen yet means nowhere to file a rating, so the stars stay
        // a read-out rather than accepting a click that would 400. Every book is
        // ratable in either mode — a Calibre-only one routes through the finder.
        onRate={currentUser ? onRate : undefined}
        isRead={
          currentUser
            ? (book) => bookIsRead(book, readSource, readStates, hardcoverRatings)
            : undefined
        }
        // Read-year grouping reads the same source the corners do; the
        // Hardcover map carries each shelf entry's last read date, so this
        // costs no extra fetch (docs/features/library-sort-and-group.md).
        finishedAt={
          currentUser
            ? (book) => bookFinishedAt(book, readSource, readStates, hardcoverRatings)
            : undefined
        }
        onToggleRead={currentUser ? onToggleRead : undefined}
        openBookReadDates={openBookReadDates}
        readDatesPending={readSource === "hardcover" && openBookIsRead && readDatesQuery.isFetching}
        readDatesError={readSource === "hardcover" && openBookIsRead ? readDatesQuery.error : null}
        openBookHardcover={openBookHardcover}
        onChooseCover={(book, bookId) => chooseCover.mutate({ workId: book.id, bookId })}
        onRefetchCover={(book) => refetchCover.mutateAsync(book.id)}
        // Needs the reader's token to ask Hardcover at all, so a session with
        // nobody chosen leaves the gear's item disabled rather than opening a
        // dialog that could only fail.
        onSetSeries={currentUser ? setSettingSeries : undefined}
        onChoosePrimarySeries={(book, seriesId) =>
          choosePrimarySeries.mutate({ workId: book.id, seriesId })
        }
      />

      <SetSeriesDialog
        open={settingSeries !== null}
        onOpenChange={(open) => !open && setSettingSeries(null)}
        bookTitle={settingSeries?.title ?? ""}
        workId={settingSeries?.id ?? 0}
        options={seriesOptions.data?.series ?? []}
        loadingOptions={seriesOptions.isPending && settingSeries !== null}
        optionsError={
          seriesOptions.error instanceof Error
            ? seriesOptions.error.message
            : currentUser?.hardcoverUsername
              ? null
              : "This reader has no Hardcover account linked. Set a series by hand:"
        }
        loadRoster={(hardcoverId) => fetchSeriesRoster(currentUser?.id as number, hardcoverId)}
        onApply={async (apply) => {
          await applySeries.mutateAsync(apply);
        }}
      />

      <HardcoverFindDialog
        pending={pendingFind}
        readerName={currentUser?.name}
        search={findSearch}
        onConfirm={async (hardcoverBookId, finishedAt) => {
          if (!pendingFind) return;
          // The finder serves two clicks: stars (rate it) and the corner
          // (mark it read) — same shelving, different write.
          if (pendingFind.rating === null) {
            await setReadState.mutateAsync({
              bookId: pendingFind.book.id,
              read: true,
              addToShelf: true,
              hardcoverBookId,
              finishedAt,
            });
          } else {
            await rate.mutateAsync({
              bookId: pendingFind.book.id,
              rating: pendingFind.rating,
              addToShelf: true,
              hardcoverBookId,
              finishedAt,
            });
          }
          setPendingFind(null);
          // The work just gained a Hardcover member — new marks on the card,
          // and one fewer candidate for the duplicates queue.
          void queryClient.invalidateQueries({ queryKey: booksQuery.queryKey });
        }}
        onCancel={() => setPendingFind(null)}
      />

      <HardcoverShelveDialog
        pending={pendingShelf}
        readerName={currentUser?.name}
        onConfirm={(finishedAt) => {
          if (pendingShelf) {
            rate.mutate({
              bookId: pendingShelf.book.id,
              rating: pendingShelf.rating,
              // An unshelved book gets added; a shelved one gets its status
              // flipped — both to Read, both with the reader's leave.
              ...(pendingShelf.statusId === null ? { addToShelf: true } : { markRead: true }),
              finishedAt,
            });
          }
          setPendingShelf(null);
        }}
        onJustRate={() => {
          if (pendingShelf) {
            rate.mutate({ bookId: pendingShelf.book.id, rating: pendingShelf.rating });
          }
          setPendingShelf(null);
        }}
        onCancel={() => setPendingShelf(null)}
      />

      <ReadStateDialog
        pending={pendingRead}
        readerName={currentUser?.name}
        onConfirm={(answer) => {
          if (pendingRead) {
            setReadState.mutate({
              bookId: pendingRead.book.id,
              read: pendingRead.read,
              finishedAt: answer.finishedAt,
              rating: answer.rating,
              removeRating: answer.removeRating,
              // Adding to shelves was the modal's own words for an unshelved book.
              addToShelf: pendingRead.read && pendingRead.shelfState === "unshelved",
            });
          }
          setPendingRead(null);
        }}
        onCancel={() => setPendingRead(null)}
      />
    </>
  );
}
