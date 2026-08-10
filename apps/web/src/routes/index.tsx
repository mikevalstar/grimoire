import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { booksQuery } from "@/lib/queries";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(booksQuery),
  component: BookList,
});

function BookList() {
  const { data: books, error, isPending } = useQuery(booksQuery);

  if (isPending) return <p>Loading…</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <p className="text-muted-foreground text-[11px] tracking-wide uppercase">{books.length} books</p>
      <ul className="mt-3 space-y-1">
        {books.map((book) => (
          <li key={book.id} className="text-[13px]">
            {book.title}
            {book.authors.length > 0 && (
              <span className="text-muted-foreground"> — {book.authors.join(", ")}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
