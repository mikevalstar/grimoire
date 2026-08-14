import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  chooseBookCover,
  type DuplicateCandidate,
  type Duplicates,
  dismissDuplicate,
  fetchBooks,
  fetchDuplicates,
  fetchPreferences,
  fetchRatings,
  fetchSyncStatus,
  fetchUsers,
  type LibraryBook,
  linkDuplicate,
  type Ratings,
  saveRating,
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
 * follows. A failed write puts the old rating back.
 */
export function useRateBook(userId: number | null | undefined) {
  const queryClient = useQueryClient();
  const key = ["ratings", userId];

  return useMutation({
    mutationFn: ({ bookId, rating }: { bookId: number; rating: number }) =>
      saveRating(userId as number, bookId, rating),

    async onMutate({ bookId, rating }) {
      // An in-flight refetch would otherwise land after us and undo the change.
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Ratings>(key);

      queryClient.setQueryData<Ratings>(key, (current) => {
        const next = { ...current };
        // Unrated is the absence of a key, matching what the API stores.
        if (rating <= 0) delete next[String(bookId)];
        else next[String(bookId)] = rating;
        return next;
      });

      return { previous };
    },

    onError(_error, _variables, context) {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
  });
}
