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
      <h1>Grimoire Books</h1>
      <p>{books.length} books</p>
      <ul>
        {books.map((book) => (
          <li key={book.id}>
            {book.title}
            {book.authors.length > 0 && <> — {book.authors.join(", ")}</>}
          </li>
        ))}
      </ul>
    </div>
  );
}
