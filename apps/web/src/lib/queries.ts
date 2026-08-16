import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  addHardcoverBook,
  chooseBookCover,
  type DuplicateCandidate,
  type Duplicates,
  dismissDuplicate,
  fetchBooks,
  fetchDuplicates,
  fetchHardcoverContent,
  fetchHardcoverRatings,
  fetchHardcoverReadDates,
  fetchPendingDuplicates,
  fetchPreferences,
  fetchRatings,
  fetchReadStates,
  fetchSyncStatus,
  fetchUsers,
  type HardcoverAdd,
  type HardcoverRatings,
  type LibraryBook,
  linkDuplicate,
  type RatingSource,
  type Ratings,
  type ReadStates,
  refetchBookCover,
  saveRating,
  saveReadState,
  saveSyncInterval,
  separateMember,
  startSync,
} from "@/lib/api";

/**
 * Query definitions live here rather than inline in components so routes can
 * prefetch the same options the component subscribes to.
 */

export const preferencesQuery = queryOptions({
  queryKey: ["preferences"],
  queryFn: fetchPreferences,
  // Preferences only change when this app writes them, and every write
  // invalidates this key.
  staleTime: Infinity,
});

export const usersQuery = queryOptions({
  queryKey: ["users"],
  queryFn: fetchUsers,
  // Same deal as preferences: only this app writes them.
  staleTime: Infinity,
});

export const booksQuery = queryOptions({
  queryKey: ["books"],
  queryFn: fetchBooks,
  // This is our own database now, and only sync writes it — so rather than
  // expiring on a timer, the list is invalidated when a sync finishes
  // (useSyncStatus below). Calibre being edited elsewhere is the sync's problem.
  staleTime: Infinity,
});

export const syncQuery = queryOptions({
  queryKey: ["sync"],
  queryFn: fetchSyncStatus,
  staleTime: 0,
});

/**
 * One reader's ratings, keyed by reader so switching who's using this device
 * swaps the stars on screen instead of showing the previous reader's.
 * See docs/features/rating-a-book.md.
 */
export function ratingsQuery(userId: number | null | undefined) {
  return queryOptions({
    queryKey: ["ratings", userId],
    queryFn: () => fetchRatings(userId as number),
    // No reader chosen yet, so there is nobody to fetch ratings for.
    enabled: userId != null,
    // Only this app writes them, and every write updates the cache in place.
    staleTime: Infinity,
  });
}

/**
 * The same map from a reader's Hardcover mirror (ADR 0014), for readers whose
 * rating source is Hardcover. Not `Infinity`-fresh like the local map: a
 * Hardcover sync also moves these, so they re-fetch on the usual triggers.
 */
export function hardcoverRatingsQuery(userId: number | null | undefined) {
  return queryOptions({
    queryKey: ["hardcover-ratings", userId],
    queryFn: () => fetchHardcoverRatings(userId as number),
    enabled: userId != null,
  });
}

/**
 * Rereads are intentionally live rather than part of the Hardcover mirror.
 * Disabling this while the panel is closed makes reopening a stale query fetch
 * again with TanStack Query's default zero stale time.
 */
export function hardcoverReadDatesQuery(
  userId: number | null | undefined,
  bookId: number | null,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: ["hardcover-read-dates", userId, bookId],
    queryFn: () => fetchHardcoverReadDates(userId as number, bookId as number),
    enabled: enabled && userId != null && bookId != null,
  });
}

/**
 * What Hardcover says about the open book — about, tags and moods
 * (docs/features/book-details-panel.md). Live like the reading history above,
 * and disabled while the panel is closed for the same reason: reopening a
 * stale query fetches again.
 */
export function hardcoverContentQuery(
  userId: number | null | undefined,
  bookId: number | null,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: ["hardcover-content", userId, bookId],
    queryFn: () => fetchHardcoverContent(userId as number, bookId as number),
    enabled: enabled && userId != null && bookId != null,
  });
}

/**
 * A reader's local read states (docs/features/marking-a-book-read.md) — the
 * corner checks, for readers whose read state lives here rather than on their
 * Hardcover shelves. Like local ratings: only this app writes them.
 */
export function readStatesQuery(userId: number | null | undefined) {
  return queryOptions({
    queryKey: ["read-states", userId],
    queryFn: () => fetchReadStates(userId as number),
    enabled: userId != null,
    staleTime: Infinity,
  });
}

/**
 * The sync's state, polled — fast while something is running so the progress
 * readout moves, slowly otherwise so an idle app is not chatty. Syncs are
 * started by a scheduler in the API process, not by this tab, so polling is how
 * a browser finds out one happened at all.
 *
 * Drops the cached library whenever a sync completes, which is what keeps the
 * shelf honest without putting an expiry on `booksQuery`.
 */
export function useSyncStatus() {
  const queryClient = useQueryClient();
  const query = useQuery({
    ...syncQuery,
    refetchInterval: (q) => (q.state.data?.running ? 1_000 : 10_000),
    // A sync finishing while the tab is hidden should still be picked up.
    refetchIntervalInBackground: false,
  });

  const lastCompletedAt = query.data?.lastCompletedAt ?? null;
  const seen = useRef<string | null>(null);

  useEffect(() => {
    if (!lastCompletedAt) return;
    // Skip the first observation: the library was fetched after that sync
    // already, so invalidating here would refetch it for nothing.
    if (seen.current === null) {
      seen.current = lastCompletedAt;
      return;
    }
    if (seen.current !== lastCompletedAt) {
      seen.current = lastCompletedAt;
      void queryClient.invalidateQueries({ queryKey: ["books"] });
    }
  }, [lastCompletedAt, queryClient]);

  return query;
}

/** Start a sync now — the indicator's click, and settings' Sync now button. */
export function useStartSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startSync,
    onSuccess: (status) => queryClient.setQueryData(syncQuery.queryKey, status),
  });
}

/** Change how often Grimoire syncs. Applies immediately, no restart. */
export function useSaveSyncInterval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveSyncInterval,
    onSuccess: (status) => {
      queryClient.setQueryData(syncQuery.queryKey, status);
      void queryClient.invalidateQueries({ queryKey: ["preferences"] });
    },
  });
}

/**
 * Swap which of a work's covers is shown, optimistically — the stack turns over
 * under the click and the PUT follows. The cached library is patched in place
 * rather than invalidated, so the shelf behind the panel turns over with it
 * without refetching every book (docs/features/book-details-panel.md).
 */
export function useChooseCover() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workId, bookId }: { workId: number; bookId: number }) =>
      chooseBookCover(workId, bookId),

    async onMutate({ workId, bookId }) {
      await queryClient.cancelQueries({ queryKey: booksQuery.queryKey });
      const previous = queryClient.getQueryData<LibraryBook[]>(booksQuery.queryKey);

      queryClient.setQueryData<LibraryBook[]>(booksQuery.queryKey, (books) =>
        books?.map((book) => (book.id === workId ? { ...book, coverBookId: bookId } : book)),
      );

      return { previous };
    },

    onError(_error, _variables, context) {
      if (context?.previous) queryClient.setQueryData(booksQuery.queryKey, context.previous);
    },
  });
}

/**
 * Fetch one book's covers again and overwrite them
 * (docs/features/book-actions.md). Not optimistic — there is nothing to show
 * until the files are actually on disk — and the answer is patched into the
 * cached library so the panel and the shelf both pick up the new
 * `coverVersion` without refetching every book.
 */
export function useRefetchCover() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workId: number) => refetchBookCover(workId),

    onSuccess(result) {
      queryClient.setQueryData<LibraryBook[]>(booksQuery.queryKey, (books) =>
        books?.map((book) => (book.id === result.book.id ? result.book : book)),
      );
    },
  });
}

/**
 * Add a book from Hardcover's catalogue to this reader's shelves, and so to the
 * library (docs/features/adding-a-book-from-hardcover.md). Nothing optimistic:
 * the library gains a book only once Hardcover has taken the write, and what it
 * gains — cover, authors, id — is the server's answer, not something this side
 * could have guessed.
 */
export function useAddHardcoverBook(userId: number | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (add: HardcoverAdd) => addHardcoverBook(userId as number, add),

    // Awaited, so the mutation settles once the library actually holds the new
    // book — the caller opens its panel the moment this resolves.
    async onSuccess() {
      // The shelf gained a book, and — for a Read — the reader gained a shelf
      // entry the corners and stars read from.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: booksQuery.queryKey }),
        queryClient.invalidateQueries({ queryKey: ["hardcover-ratings", userId] }),
      ]);
    },
  });
}

/**
 * What the open book might be a duplicate of, and the entries it is already
 * made of (docs/features/resolving-duplicates.md). Fetched per book, when a
 * panel opens — a suggestion is derived from data the server already holds, so
 * there is nothing to keep warm.
 */
export function duplicatesQuery(workId: number | null) {
  return queryOptions({
    queryKey: ["duplicates", workId],
    queryFn: () => fetchDuplicates(workId as number),
    enabled: workId != null,
    // Only this app changes the answer, and every mutation below writes it back.
    staleTime: Infinity,
  });
}

/**
 * The review queue in settings (docs/features/resolving-duplicates.md).
 * Shares the "duplicates" key prefix, so a merge's invalidation refreshes
 * this list too.
 */
export const pendingDuplicatesQuery = queryOptions({
  queryKey: ["duplicates", "pending"],
  queryFn: fetchPendingDuplicates,
});

/**
 * These two are the same book. The library reloads because a merge changes what
 * is on the shelf — one card where there were two — and the ratings with it,
 * since the surviving work may not be the one the reader was looking at.
 */
export function useLinkDuplicate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workId, otherWorkId }: { workId: number; otherWorkId: number }) =>
      linkDuplicate(workId, otherWorkId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: booksQuery.queryKey });
      void queryClient.invalidateQueries({ queryKey: ["duplicates"] });
      void queryClient.invalidateQueries({ queryKey: ["ratings"] });
    },
  });
}

/**
 * Not the same book. Nothing on the shelf changes, and the server answers with
 * the list as it now stands — so this writes that back rather than refetching.
 */
export function useDismissDuplicate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      workId,
      bookId,
      otherBookId,
    }: {
      workId: number;
      bookId: number;
      otherBookId: number;
    }) => dismissDuplicate(workId, bookId, otherBookId),
    onSuccess: (duplicates, { workId }) => {
      queryClient.setQueryData<Duplicates>(["duplicates", workId], duplicates);
    },
  });
}

/**
 * Everything the details panel's **Same book** section needs for one book: the
 * suggestions, the three answers, and whether one is in flight.
 *
 * Bundled because which book is open is screen state
 * (docs/features/book-details-panel.md) — the component that knows it is not
 * the one that owns the queries, and this is the seam between them.
 *
 * `onMerged` is how the panel follows a merge: the surviving work is the older
 * of the two, so it is not always the one the reader had open.
 */
export function useDuplicates(workId: number | null, onMerged?: (book: LibraryBook) => void) {
  const { data } = useQuery(duplicatesQuery(workId));
  const link = useLinkDuplicate();
  const dismiss = useDismissDuplicate();
  const separate = useSeparateMember();

  /**
   * Join another work to this one. Awaited rather than fired off, because the
   * manual picker stays open until it lands — a search that closed on a failed
   * write would look like it worked (docs/features/resolving-duplicates.md).
   */
  const onLinkWork = async (otherWorkId: number) => {
    if (workId === null) return;
    onMerged?.(await link.mutateAsync({ workId, otherWorkId }));
  };

  return {
    duplicates: data,
    busy: link.isPending || dismiss.isPending || separate.isPending,
    onLinkWork,
    onLink: ({ workId: otherWorkId }: DuplicateCandidate) => {
      if (workId === null) return;
      link.mutate({ workId, otherWorkId }, { onSuccess: onMerged });
    },
    onDismiss: ({ bookId, otherBookId }: DuplicateCandidate) => {
      if (workId === null) return;
      dismiss.mutate({ workId, bookId, otherBookId });
    },
    onSeparate: (bookId: number) => {
      if (workId === null) return;
      separate.mutate({ workId, bookId });
    },
  };
}

/** Move one entry back out on its own — the undo for a merge. */
export function useSeparateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workId, bookId }: { workId: number; bookId: number }) =>
      separateMember(workId, bookId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: booksQuery.queryKey });
      void queryClient.invalidateQueries({ queryKey: ["duplicates"] });
    },
  });
}

/**
 * Rate a book, optimistically: the stars move under the pointer and the PUT
 * follows. A failed write puts the old rating back — including a Hardcover
 * write their API refused (ADR 0014).
 */
export function useRateBook(userId: number | null | undefined, source: RatingSource = "local") {
  const queryClient = useQueryClient();
  const key = source === "hardcover" ? ["hardcover-ratings", userId] : ["ratings", userId];

  return useMutation({
    mutationFn: ({
      bookId,
      rating,
      addToShelf,
      hardcoverBookId,
      markRead,
      finishedAt,
    }: RateVariables) =>
      saveRating(userId as number, bookId, rating, {
        source,
        addToShelf,
        hardcoverBookId,
        markRead,
        finishedAt,
      }),

    async onMutate({ bookId, rating, addToShelf, markRead }) {
      // An in-flight refetch would otherwise land after us and undo the change.
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Ratings | HardcoverRatings>(key);

      // Widened to either map's values: local bare numbers, Hardcover's
      // rating-with-status entries.
      queryClient.setQueryData<Record<string, number | HardcoverRatings[string]>>(
        key,
        (current) => {
          const next = { ...current };
          const id = String(bookId);
          if (source === "hardcover") {
            // The book stays shelved when the rating clears — null is the
            // unrated their mirror stores. Shelving or marking read lands on
            // status 3; otherwise the status stands.
            const existing = next[id];
            const statusId =
              addToShelf || markRead || typeof existing === "number" || existing == null
                ? 3
                : existing.statusId;
            next[id] = { rating: rating > 0 ? rating : null, statusId };
          } else if (rating <= 0) delete next[id];
          else next[id] = rating;
          return next;
        },
      );

      return { previous };
    },

    onError(_error, _variables, context) {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
  });
}

/**
 * Mark a book read or unread, optimistically, through whichever source the
 * reader's read state lives in (docs/features/marking-a-book-read.md). The
 * optional rating and removeRating side effects patch the matching ratings
 * cache too; a failed write puts both back.
 */
export function useSetReadState(userId: number | null | undefined, source: RatingSource = "local") {
  const queryClient = useQueryClient();
  const readKey = source === "hardcover" ? ["hardcover-ratings", userId] : ["read-states", userId];
  // Only same-source rating side effects exist, by design — so the cache to
  // patch is the one belonging to this source.
  const ratingKey = source === "hardcover" ? readKey : ["ratings", userId];

  return useMutation({
    mutationFn: ({ bookId, ...update }: ReadStateVariables) =>
      saveReadState(userId as number, bookId, { ...update, source }),

    async onMutate({ bookId, read, finishedAt, rating, removeRating }) {
      await queryClient.cancelQueries({ queryKey: readKey });
      await queryClient.cancelQueries({ queryKey: ratingKey });
      const previousRead = queryClient.getQueryData(readKey);
      const previousRatings = queryClient.getQueryData(ratingKey);
      const id = String(bookId);

      if (source === "hardcover") {
        // One cache holds both: status flips, and the rating rides along.
        queryClient.setQueryData<HardcoverRatings>(readKey, (current) => {
          const next = { ...current };
          const existing = next[id];
          if (read) {
            next[id] = { rating: rating ?? existing?.rating ?? null, statusId: 3 };
          } else if (existing) {
            // Back to Want to Read — what unmarking means on their shelves.
            next[id] = { rating: removeRating ? null : existing.rating, statusId: 1 };
          }
          return next;
        });
      } else {
        queryClient.setQueryData<ReadStates>(readKey, (current) => {
          const next = { ...current };
          if (read) next[id] = { finishedAt: finishedAt ?? null };
          else delete next[id];
          return next;
        });
        if (rating !== undefined || removeRating) {
          queryClient.setQueryData<Ratings>(ratingKey, (current) => {
            const next = { ...current };
            if (read && rating !== undefined) next[id] = rating;
            else if (!read && removeRating) delete next[id];
            return next;
          });
        }
      }

      return { previousRead, previousRatings };
    },

    onError(_error, _variables, context) {
      if (context?.previousRead) queryClient.setQueryData(readKey, context.previousRead);
      if (context?.previousRatings) queryClient.setQueryData(ratingKey, context.previousRatings);
    },
  });
}

interface ReadStateVariables {
  bookId: number;
  read: boolean;
  finishedAt?: string;
  rating?: number;
  removeRating?: boolean;
  addToShelf?: boolean;
  hardcoverBookId?: number;
}

interface RateVariables {
  bookId: number;
  rating: number;
  /** The reader's confirmation that rating may shelve the book as Read (ADR 0014). */
  addToShelf?: boolean;
  /** The finder's pick, for a work with no Hardcover edition yet. */
  hardcoverBookId?: number;
  /** The reader's confirmation that a shelved-but-unfinished book may flip to Read. */
  markRead?: boolean;
  /** When they finished it — "2023", "2023-06" or "2023-06-15"; absent = unknown. */
  finishedAt?: string;
}
