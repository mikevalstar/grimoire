import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { BookLibrary } from "@/components/book-library";
import { HardcoverFindDialog, type PendingFind } from "@/components/hardcover-find-dialog";
import { HardcoverShelveDialog, type PendingShelve } from "@/components/hardcover-shelve-dialog";
import { type PendingReadState, ReadStateDialog } from "@/components/read-state-dialog";
import { BOOK_SOURCE, bookIsRead, bookRating, type LibraryBook, searchHardcover } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";
import {
  booksQuery,
  hardcoverRatingsQuery,
  ratingsQuery,
  readStatesQuery,
  useChooseCover,
  useRateBook,
  useSetReadState,
} from "@/lib/queries";

export const Route = createFileRoute("/")({
  // Prefetch, but don't fail the route on it: a content server that's down is
  // a state the screen draws (with the proxy's hint), not a router error.
  loader: ({ context }) => context.queryClient.ensureQueryData(booksQuery).catch(() => undefined),
  component: LibraryScreen,
});

function LibraryScreen() {
  const { data: books, error, isPending, refetch } = useQuery(booksQuery);

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

  return (
    <>
      <BookLibrary
        books={books}
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
        onToggleRead={currentUser ? onToggleRead : undefined}
        onChooseCover={(book, bookId) => chooseCover.mutate({ workId: book.id, bookId })}
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
