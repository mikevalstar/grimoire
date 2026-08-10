import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

// Hello world: an unstyled list of books pulled from the Calibre content
// server through our /api/cs proxy.

interface CsBook {
  id: number;
  title: string;
  authors: string[];
}

async function fetchCsBooks(): Promise<CsBook[]> {
  const searchRes = await fetch(`${API_BASE}/api/cs/ajax/search?num=9999&sort=title`);
  if (!searchRes.ok) throw new Error((await searchRes.json()).error ?? searchRes.statusText);
  const search: { book_ids: number[] } = await searchRes.json();
  if (search.book_ids.length === 0) return [];

  const metaRes = await fetch(`${API_BASE}/api/cs/ajax/books?ids=${search.book_ids.join(",")}`);
  if (!metaRes.ok) throw new Error((await metaRes.json()).error ?? metaRes.statusText);
  const meta: Record<string, { title: string; authors: string[] | null }> = await metaRes.json();

  return search.book_ids.map((id) => ({
    id,
    title: meta[String(id)]?.title ?? `(book ${id})`,
    authors: meta[String(id)]?.authors ?? [],
  }));
}

export default function App() {
  const [books, setBooks] = useState<CsBook[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCsBooks()
      .then(setBooks)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <p>Error: {error}</p>;
  if (books === null) return <p>Loading…</p>;

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
