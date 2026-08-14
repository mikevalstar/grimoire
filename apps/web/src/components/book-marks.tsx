import type { LucideIcon } from "lucide-react";
import { Bookmark, LibraryBig, Unlink } from "lucide-react";
import { BookBadge, type BookBadgeProps } from "@/components/book-badge";
import { BOOK_SOURCE, type LibraryBook } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * One small statement about a book, drawn in the corner of its cover.
 *
 * A book has a *list* of these rather than one, because it is about to have
 * more than one source: matching Calibre against Hardcover turns two rows into
 * one row that came from both, and that book wants both marks
 * (docs/features/hardcover-sync.md). Everything here is already plural, so that
 * day changes what `bookMarks` returns and nothing else.
 */
export interface BookMark {
  /** Stable across renders — the React key, and what a test would name. */
  id: string;
  /** The accessible name, and the visible text where there is room for it. */
  label: string;
  /** The longer version, on hover. A nine-pixel mark cannot explain itself. */
  title: string;
  icon: LucideIcon;
}

const CALIBRE: BookMark = {
  id: "calibre",
  label: "Calibre",
  title: "This book is in the connected Calibre library.",
  icon: LibraryBig,
};

const CALIBRE_GONE: BookMark = {
  id: "calibre-gone",
  label: "No longer in Calibre",
  title:
    "Grimoire still has this book's details, cover and your rating, but Calibre no longer lists it — so there is no file to download.",
  icon: Unlink,
};

const HARDCOVER: BookMark = {
  id: "hardcover",
  label: "Hardcover",
  title:
    "This book is on a reader's hardcover.app shelves. Grimoire does not match sources yet, so a book in both libraries appears twice.",
  icon: Bookmark,
};

/**
 * What to say about this book. One mark per source it came from — and for
 * Calibre, the mark itself carries whether the book is still there, rather than
 * a second mark contradicting the first.
 *
 * Sources Grimoire doesn't have copy for are skipped rather than guessed at.
 */
export function bookMarks(book: Pick<LibraryBook, "sources" | "calibreId">): BookMark[] {
  return book.sources.flatMap((source) => {
    if (source === BOOK_SOURCE.calibre) return [book.calibreId === null ? CALIBRE_GONE : CALIBRE];
    if (source === BOOK_SOURCE.hardcover) return [HARDCOVER];
    return [];
  });
}

export interface BookMarksProps {
  book: Pick<LibraryBook, "sources" | "calibreId">;
  /** `overlay` sits on a cover, `inline` on the canvas beside a title. */
  variant?: BookBadgeProps["variant"];
  className?: string;
}

/**
 * Where a book came from, and what has happened to it since.
 *
 * Icons only, everywhere. Nearly every book in a Calibre library carries the
 * same mark, and a list of two hundred rows each spelling out "Calibre" is a
 * word repeated until it stops being read — while the icons still separate the
 * handful that say something else. The names live in the tooltip and in the
 * accessible name, which is where the explanation was always going to be.
 */
export function BookMarks({ book, variant = "inline", className }: BookMarksProps) {
  const marks = bookMarks(book);
  if (marks.length === 0) return null;

  return (
    // A span rather than a list: these sit inside a table cell's own flex row,
    // where a <ul> would not be valid.
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {marks.map((mark) => (
        <BookBadge key={mark.id} variant={variant} title={mark.title}>
          <mark.icon size={12} aria-hidden="true" />
          <span className="sr-only">{mark.label}</span>
        </BookBadge>
      ))}
    </span>
  );
}
