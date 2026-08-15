import { Loader2 } from "lucide-react";
import { BookCover } from "@/components/book-cover";
import { BookMarks } from "@/components/book-marks";
import { Button } from "@/components/ui/button";
import type { DuplicateReason, LibraryBook, PendingDuplicate } from "@/lib/api";

/** Why a pair is suspected, in words a reader can decide against. */
const REASON: Record<DuplicateReason, string> = {
  exact: "Same title and author",
  subtitle: "Same author, and one title extends the other",
  title: "Same title, different author",
};

/**
 * The library-wide review queue (docs/features/resolving-duplicates.md):
 * every pair the matcher refused and nobody has answered, each row carrying
 * both books and the panel's two answers. Purely presentational — the
 * settings pane owns the queries and the writes.
 */
export function DuplicateQueue({
  pairs,
  total,
  bookFor,
  onSame,
  onNotSame,
  busy,
  loading,
}: {
  pairs: PendingDuplicate[];
  /** Pairs found before the cap — when it exceeds `pairs`, the list was trimmed. */
  total: number;
  /** Pairs name works; the shelf already holds every book (see the panel). */
  bookFor: (workId: number) => LibraryBook | undefined;
  onSame: (pair: PendingDuplicate) => void;
  onNotSame: (pair: PendingDuplicate) => void;
  /** An answer is in flight; the buttons stop taking clicks until it lands. */
  busy?: boolean;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-[13px]">
        <Loader2 size={13} className="animate-spin" />
        Looking for unanswered pairs…
      </p>
    );
  }

  // A pair whose books the shelf can't name is stale — a merge or sync moved
  // things since the queue was fetched. It'll be gone on the next refetch.
  const known = pairs.flatMap((pair) => {
    const book = bookFor(pair.workId);
    const other = bookFor(pair.otherWorkId);
    return book && other ? [{ pair, book, other }] : [];
  });

  if (known.length === 0) {
    return (
      <p className="text-muted-foreground text-[13px]">
        Nothing waiting. Every near miss the matcher found has been answered — new ones show up here
        after a sync brings something ambiguous in.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {total > pairs.length && (
        <p className="text-muted-foreground text-[12px]">
          Showing {pairs.length.toLocaleString()} of {total.toLocaleString()} — answering makes
          room.
        </p>
      )}
      {known.map(({ pair, book, other }) => (
        <div
          key={`${pair.bookId}:${pair.otherBookId}`}
          className="border-line bg-fill/40 grid gap-2.5 rounded-lg border p-2.5"
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            <PairBook book={book} />
            <PairBook book={other} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-you-soft flex-1 text-[11px]">{REASON[pair.reason]}</p>
            <Button size="xs" variant="secondary" disabled={busy} onClick={() => onSame(pair)}>
              Same book
            </Button>
            <Button size="xs" variant="ghost" disabled={busy} onClick={() => onNotSame(pair)}>
              Not the same
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Half of a pair: cover, title, author, year and source marks — the artwork is
 * what a reader actually recognises when the titles are identical.
 */
function PairBook({ book }: { book: LibraryBook }) {
  const year = book.published ? new Date(book.published).getFullYear() : null;

  return (
    <div className="flex min-w-0 gap-2.5">
      <BookCover book={book} width={40} className="w-10 shrink-0" />
      <div className="min-w-0">
        <div className="flex items-start gap-2">
          <p className="text-foreground min-w-0 text-[12.5px] leading-snug font-medium">
            {book.title}
          </p>
          <BookMarks book={book} className="shrink-0" />
        </div>
        <p className="text-muted-foreground mt-0.5 truncate text-[11.5px]">
          {book.authors.length > 0 ? book.authors.join(", ") : "Unknown author"}
          {year && year > 1000 && ` · ${year}`}
        </p>
      </div>
    </div>
  );
}
