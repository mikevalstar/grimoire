import { ArrowLeft, Search } from "lucide-react";
import { useState } from "react";
import { BookCover } from "@/components/book-cover";
import { BookMarks } from "@/components/book-marks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LibraryBook } from "@/lib/api";

export interface BookLinkPickerProps {
  /** The book being joined *from* — named in the heading, and never a result. */
  book: LibraryBook;
  /** The shelf, filtered. See `searchBooks` — this runs in the browser. */
  search: (query: string) => LibraryBook[];
  /**
   * Join that work to this one. Resolves when the merge lands, rejects with
   * something worth showing — the picker stays open until it settles, since a
   * search that closed on a failed write would look like it worked.
   */
  onPick: (workId: number) => Promise<void>;
  /** Back, without joining anything. */
  onCancel: () => void;
}

/**
 * Find the other copy of a book by hand, when the matcher's suggestions can't
 * see it — a translation, a boxed set, a title someone retyped.
 * See docs/features/resolving-duplicates.md.
 *
 * It replaces the panel's body rather than opening over it: the book being
 * joined from stays in the header, where a comparison needs it.
 */
export function BookLinkPicker({ book, search, onPick, onCancel }: BookLinkPickerProps) {
  // Seeded with the book's own title, so the thing being looked for is usually
  // already on screen — the suggestion flow, arrived at the long way round.
  const [query, setQuery] = useState(book.title);
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const results = search(query);

  const pick = async (workId: number) => {
    setPending(workId);
    setError(null);
    try {
      await onPick(workId);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That didn't work.");
      setPending(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={onCancel} aria-label="Back to the book">
          <ArrowLeft size={16} aria-hidden="true" />
        </Button>
        {/* The panel's own header is still above this, so the book being joined
            from is on screen and does not want naming twice. */}
        <p className="text-foreground min-w-0 flex-1 truncate text-[12.5px] font-medium">
          Link a duplicate
        </p>
      </div>

      <div className="relative mt-3">
        <Search
          size={14}
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
        />
        <Input
          // The reader asked for this by pressing a button, and typing is the
          // only thing to do here — so it takes the caret. The title is a
          // starting point rather than an answer, and it is selected so the
          // first keystroke replaces it.
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the library by title or author"
          aria-label="Search the library"
          className="pl-8"
        />
      </div>

      {error && <p className="text-destructive mt-2 text-[12px]">{error}</p>}

      <div className="mt-3 space-y-1.5">
        {results.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-[12.5px]">
            {query.trim() ? "Nothing on the shelf matches that." : "Type to search the library."}
          </p>
        ) : (
          results.map((result) => (
            <Result
              key={result.id}
              book={result}
              busy={pending !== null}
              pending={pending === result.id}
              onPick={() => void pick(result.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * One book to join to. It leads with the cover: the reader is looking for
 * another copy of a book they can see, and two rows of one title are told apart
 * by the artwork long before the text.
 */
function Result({
  book,
  busy,
  pending,
  onPick,
}: {
  book: LibraryBook;
  busy: boolean;
  pending: boolean;
  onPick: () => void;
}) {
  const year = book.published ? new Date(book.published).getFullYear() : null;

  return (
    <button
      type="button"
      disabled={busy}
      onClick={onPick}
      className="border-line hover:border-you/50 hover:bg-fill/60 flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors disabled:opacity-50"
    >
      <BookCover book={book} width={36} className="w-9 shrink-0" />

      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-[12.5px] font-medium">
          {book.title}
        </span>
        <span className="text-muted-foreground block truncate text-[11.5px]">
          {book.authors.length > 0 ? book.authors.join(", ") : "Unknown author"}
          {year && year > 1000 && ` · ${year}`}
          {/* A work that is already several rows is a bigger thing to join than
              it looks: all of them come across. */}
          {book.entries > 1 && ` · ${book.entries} entries`}
        </span>
      </span>

      {pending ? (
        <span className="text-muted-foreground shrink-0 text-[11px]">Joining…</span>
      ) : (
        <BookMarks book={book} className="shrink-0" />
      )}
    </button>
  );
}
