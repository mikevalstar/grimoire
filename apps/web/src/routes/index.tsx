import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BookLibrary } from "@/components/book-library";
import { booksQuery } from "@/lib/queries";

export const Route = createFileRoute("/")({
  // Prefetch, but don't fail the route on it: a content server that's down is
  // a state the screen draws (with the proxy's hint), not a router error.
  loader: ({ context }) => context.queryClient.ensureQueryData(booksQuery).catch(() => undefined),
  component: LibraryScreen,
});

function LibraryScreen() {
  const { data: books, error, isPending, refetch } = useQuery(booksQuery);

  return (
    <BookLibrary books={books} isPending={isPending} error={error} onRetry={() => void refetch()} />
  );
}
