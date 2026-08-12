import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  fetchBooks,
  fetchPreferences,
  fetchRatings,
  fetchSyncStatus,
  fetchUsers,
  type Ratings,
  saveRating,
  saveSyncInterval,
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
