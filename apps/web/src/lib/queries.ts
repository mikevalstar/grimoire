import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchBooks,
  fetchPreferences,
  fetchRatings,
  fetchUsers,
  type Ratings,
  saveRating,
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
  // Calibre is edited outside Grimoire, so don't cache the library for long.
  staleTime: 30_000,
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
