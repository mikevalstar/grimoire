import { Split } from "lucide-react";
import { BookCover } from "@/components/book-cover";
import { BookMarks, sourceMark } from "@/components/book-marks";
import { Button } from "@/components/ui/button";
import type { DuplicateCandidate, DuplicateReason, Duplicates, LibraryBook } from "@/lib/api";

/** Why this book is being suggested, in words a reader can decide against. */
const REASON: Record<DuplicateReason, string> = {
  exact: "Same title and author",
  subtitle: "Same author, and one title extends the other",
  title: "Same title, different author",
};

export interface BookDuplicatesProps {
  duplicates: Duplicates;
  /**
   * A candidate by work id. Candidates name a work and carry no metadata of
   * their own, because the shelf already holds every book — one lookup keeps
   * the panel and the shelf from showing different things.
   */
  bookFor: (workId: number) => LibraryBook | undefined;
  /** These two are the same book. Without it the suggestion is a read-out. */
  onLink?: (candidate: DuplicateCandidate) => void;
  /** They are not, and it should stop being suggested. */
  onDismiss?: (candidate: DuplicateCandidate) => void;
  /** Move one entry back out on its own — the undo for a merge. */
  onSeparate?: (bookId: number) => void;
  /** A write is in flight; the answers stop taking clicks until it lands. */
  busy?: boolean;
}

/**
 * Whether there is anything to say about this work's entries: it is made of
 * more than one, or something looks like it belongs in it. False for nearly
 * every book, which is why the panel asks before drawing a heading.
 */
export function hasDuplicates(duplicates: Duplicates | undefined): duplicates is Duplicates {
  if (!duplicates) return false;
  return duplicates.members.length > 1 || duplicates.candidates.length > 0;
}

/**
 * The entries a book is made of, and the ones that look like they belong with
 * it — with a click to say either way.
 * See docs/features/resolving-duplicates.md.
 *
 * The reader is never asked to go and find the duplicate: the matcher's near
 * misses are what this lists, so the common answer is one click on something
 * already on screen.
 */
export function BookDuplicates({
  duplicates,
  bookFor,
  onLink,
  onDismiss,
  onSeparate,
  busy,
}: BookDuplicatesProps) {
  const { members, candidates } = duplicates;
  // A candidate whose work the shelf hasn't heard of is a list one sync out of
  // date. Skipping it beats drawing a row with no title on it.
  const known = candidates.flatMap((candidate) => {
    const book = bookFor(candidate.workId);
    return book ? [{ candidate, book }] : [];
  });

  if (members.length <= 1 && known.length === 0) return null;

  return (
    <div className="space-y-3">
      {members.length > 1 && (
        <ul className="space-y-1">
          {members.map((member) => {
            const mark = sourceMark(member.source);
            return (
              <li
                key={member.bookId}
                className="border-line bg-fill/40 flex items-center gap-2 rounded-md border px-2 py-1.5"
              >
                {mark && (
                  <mark.icon
                    size={13}
                    aria-hidden="true"
                    className="text-muted-foreground shrink-0"
                  />
                )}
                <span className="text-muted-foreground w-[68px] shrink-0 text-[11px]">
                  {mark?.label ?? member.source}
                </span>
                {/* The entry's *own* title, not the work's merged one: the
                    difference between them is the reason to look at this list. */}
                <span className="text-foreground/85 min-w-0 flex-1 truncate text-[12.5px]">
                  {member.title}
                </span>
                {onSeparate && (
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={busy}
                    onClick={() => onSeparate(member.bookId)}
                    className="text-muted-foreground shrink-0"
                  >
                    <Split size={12} aria-hidden="true" />
                    Separate
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {known.length > 0 && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-[11px]">
            {known.length === 1
              ? "This might be the same book:"
              : `${known.length} of these might be the same book:`}
          </p>
          {known.map(({ candidate, book }) => (
            <CandidateRow
              key={candidate.workId}
              candidate={candidate}
              book={book}
              onLink={onLink}
              onDismiss={onDismiss}
              busy={busy}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One suggestion. It shows a cover, an author and a year rather than a title
 * alone: two rows of one book are textually identical, and the artwork is what
 * a reader actually recognises.
 */
function CandidateRow({
  candidate,
  book,
  onLink,
  onDismiss,
  busy,
}: {
  candidate: DuplicateCandidate;
  book: LibraryBook;
  onLink?: (candidate: DuplicateCandidate) => void;
  onDismiss?: (candidate: DuplicateCandidate) => void;
  busy?: boolean;
}) {
  const year = book.published ? new Date(book.published).getFullYear() : null;

  return (
    <div className="border-line bg-fill/40 flex gap-3 rounded-lg border p-2.5">
      <BookCover book={book} width={44} className="w-11 shrink-0" />

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="text-foreground min-w-0 flex-1 text-[12.5px] leading-snug font-medium">
            {book.title}
          </p>
          <BookMarks book={book} className="shrink-0" />
        </div>
        <p className="text-muted-foreground mt-0.5 truncate text-[11.5px]">
          {book.authors.length > 0 ? book.authors.join(", ") : "Unknown author"}
          {year && year > 1000 && ` · ${year}`}
        </p>
        <p className="text-you-soft mt-1 text-[11px]">{REASON[candidate.reason]}</p>

        {(onLink || onDismiss) && (
          <div className="mt-2 flex gap-1.5">
            {onLink && (
              <Button
                size="xs"
                variant="secondary"
                disabled={busy}
                onClick={() => onLink(candidate)}
              >
                Same book
              </Button>
            )}
            {onDismiss && (
              <Button
                size="xs"
                variant="ghost"
                disabled={busy}
                onClick={() => onDismiss(candidate)}
                className="text-muted-foreground"
              >
                Not the same
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
