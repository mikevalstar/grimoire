import { queryOptions } from "@tanstack/react-query";
import { fetchBooks, fetchPreferences } from "@/lib/api";

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

export const booksQuery = queryOptions({
  queryKey: ["books"],
  queryFn: fetchBooks,
  // Calibre is edited outside Grimoire, so don't cache the library for long.
  staleTime: 30_000,
});
