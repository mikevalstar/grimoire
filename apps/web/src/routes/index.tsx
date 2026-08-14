import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BookLibrary } from "@/components/book-library";
import { useCurrentUser } from "@/lib/current-user";
import { booksQuery, ratingsQuery, useChooseCover, useRateBook } from "@/lib/queries";

export const Route = createFileRoute("/")({
  // Prefetch, but don't fail the route on it: a content server that's down is
  // a state the screen draws (with the proxy's hint), not a router error.
  loader: ({ context }) => context.queryClient.ensureQueryData(booksQuery).catch(() => undefined),
  component: LibraryScreen,
});

function LibraryScreen() {
  const { data: books, error, isPending, refetch } = useQuery(booksQuery);

  // Ratings belong to whoever is using this device, and follow them when that
  // changes (docs/features/rating-a-book.md).
  const currentUser = useCurrentUser();
  const { data: ratings } = useQuery(ratingsQuery(currentUser?.id));
  const rate = useRateBook(currentUser?.id);

  // Which cover a work shows is the library's, not a reader's, so this needs
  // nobody to be chosen first (docs/features/book-details-panel.md).
  const chooseCover = useChooseCover();

  return (
    <BookLibrary
      books={books}
      isPending={isPending}
      error={error}
      onRetry={() => void refetch()}
      ratings={ratings}
      // No reader chosen yet means nowhere to file a rating, so the stars stay
      // a read-out rather than accepting a click that would 400.
      onRate={currentUser ? (book, rating) => rate.mutate({ bookId: book.id, rating }) : undefined}
      onChooseCover={(book, bookId) => chooseCover.mutate({ workId: book.id, bookId })}
    />
  );
}
