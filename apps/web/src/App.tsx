import { useEffect, useState } from "react";
import { BookOpen, Library, Search, Star } from "lucide-react";
import { ApiError, coverUrl, fetchBooks, type Book } from "@/lib/api";

export default function App() {
  const [search, setSearch] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      fetchBooks({ search, limit: 200 })
        .then((list) => {
          setBooks(list.books);
          setTotal(list.total);
          setError(null);
        })
        .catch((err) => setError(err))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timeout);
  }, [search]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
          <div className="flex items-center gap-2">
            <Library className="size-5" />
            <h1 className="text-lg font-semibold tracking-tight">Grimoire Books</h1>
          </div>
          <div className="relative ml-auto w-full max-w-sm">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or author…"
              className="w-full rounded-md border bg-transparent py-1.5 pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {!loading && !error && (
            <span className="text-sm whitespace-nowrap text-muted-foreground">
              {total} book{total === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {error ? (
          <LibraryProblem error={error} />
        ) : loading && books.length === 0 ? (
          <p className="py-20 text-center text-muted-foreground">Loading library…</p>
        ) : books.length === 0 ? (
          <p className="py-20 text-center text-muted-foreground">No books match “{search}”.</p>
        ) : (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function BookCard({ book }: { book: Book }) {
  const cover = coverUrl(book);
  return (
    <div className="group flex flex-col gap-2">
      <div className="relative aspect-2/3 overflow-hidden rounded-lg border bg-muted shadow-sm transition-shadow group-hover:shadow-md">
        {cover ? (
          <img
            src={cover}
            alt={`Cover of ${book.title}`}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 p-3 text-center">
            <BookOpen className="size-6 text-muted-foreground" />
            <span className="text-xs leading-tight text-muted-foreground">{book.title}</span>
          </div>
        )}
        {book.rating != null && book.rating > 0 && (
          <span className="absolute right-1.5 bottom-1.5 flex items-center gap-0.5 rounded-md bg-background/85 px-1.5 py-0.5 text-xs font-medium backdrop-blur">
            <Star className="size-3 fill-current" />
            {book.rating}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium" title={book.title}>
          {book.title}
        </p>
        <p className="truncate text-xs text-muted-foreground" title={book.authors.join(", ")}>
          {book.authors.join(", ") || "Unknown author"}
        </p>
        {book.series && (
          <p className="truncate text-xs text-muted-foreground/70">
            {book.series}
            {book.seriesIndex != null ? ` #${book.seriesIndex}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

function LibraryProblem({ error }: { error: ApiError | Error }) {
  const hint = error instanceof ApiError ? error.hint : undefined;
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <Library className="mx-auto mb-4 size-10 text-muted-foreground" />
      <h2 className="mb-2 text-lg font-semibold">Can't reach your library</h2>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      {hint && <p className="mt-2 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
