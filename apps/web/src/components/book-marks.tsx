import { Sparkles, Unlink } from "lucide-react";
import type { ComponentType } from "react";
import { BookBadge, type BookBadgeProps } from "@/components/book-badge";
import { CalibreIcon, HardcoverIcon } from "@/components/brand-icons";
import { BOOK_SOURCE, type LibraryBook } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * One small statement about a book, drawn in the corner of its cover.
 *
 * A book has a *list* of these rather than one, because a book can have more
 * than one source: matching groups a Calibre row and a Hardcover row under one
 * work, and the card for that work wears both marks
 * (docs/features/book-matching.md).
 */
export interface BookMark {
  /** Stable across renders — the React key, and what a test would name. */
  id: string;
  /** The accessible name, and the visible text where there is room for it. */
  label: string;
  /** The longer version, on hover. A nine-pixel mark cannot explain itself. */
  title: string;
  /**
   * Anything drawn like a lucide icon — which the real Calibre and Hardcover
   * marks are (`@/components/brand-icons`), so a source can wear its own logo.
   */
  icon: MarkIcon;
  /**
   * Badge classes, by placement, for a mark that wears a colour of its own.
   * Calibre and Hardcover bring a logo and leave the badge neutral; Grimoire's
   * own mark is a glyph, so the colour is what makes it recognisable
   * (docs/features/uploading-a-book.md).
   */
  tone?: { inline: string; overlay: string };
}

/** The shape both lucide icons and the brand marks satisfy. */
export type MarkIcon = ComponentType<{
  size?: number;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;

const CALIBRE: BookMark = {
  id: "calibre",
  label: "Calibre",
  title: "This book is in the connected Calibre library.",
  icon: CalibreIcon,
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
  title: "This book is on a reader's hardcover.app shelves.",
  icon: HardcoverIcon,
};

/**
 * Grimoire's own: the file was uploaded here and lives on this disk
 * (docs/features/uploading-a-book.md). A lucide glyph rather than a logo,
 * since the application being named is this one — drawn in the app's own
 * indigo, the "you" accent, which is the colour everything Grimoire owns
 * already wears.
 */
const GRIMOIRE: BookMark = {
  id: "grimoire",
  label: "Grimoire",
  title: "Grimoire holds this book's file itself — it was uploaded here.",
  icon: Sparkles,
  tone: {
    inline: "border-you/40 bg-you-dim text-you-soft",
    overlay: "border-you-soft/40 bg-you/80 text-white",
  },
};

/**
 * The mark for a source on its own, saying nothing about what has happened to
 * the book since — what one *entry* of a work is labelled with when the entries
 * are being listed rather than the book (docs/features/resolving-duplicates.md).
 *
 * Null for a source Grimoire has no copy for, which is skipped rather than
 * guessed at.
 */
export function sourceMark(source: string): BookMark | null {
  if (source === BOOK_SOURCE.calibre) return CALIBRE;
  if (source === BOOK_SOURCE.hardcover) return HARDCOVER;
  if (source === BOOK_SOURCE.grimoire) return GRIMOIRE;
  return null;
}

/** Grimoire's own mark leads; the sources it mirrors follow in the order the API gave them. */
const MARK_ORDER: readonly string[] = [BOOK_SOURCE.grimoire];

/**
 * What to say about this book. One mark per source it came from — and for
 * Calibre, the mark itself carries whether the book is still there, rather than
 * a second mark contradicting the first. Grimoire's mark comes first whenever
 * it is present: the file this app holds itself outranks the copies it only
 * knows about (docs/features/uploading-a-book.md).
 */
export function bookMarks(book: Pick<LibraryBook, "sources" | "calibreId">): BookMark[] {
  const rank = (source: string) => {
    const index = MARK_ORDER.indexOf(source);
    return index === -1 ? MARK_ORDER.length : index;
  };
  return [...book.sources]
    .sort((a, b) => rank(a) - rank(b))
    .flatMap((source) => {
      if (source === BOOK_SOURCE.calibre && book.calibreId === null) return [CALIBRE_GONE];
      const mark = sourceMark(source);
      return mark ? [mark] : [];
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
 * Icons only, everywhere — and for a source, its own logo rather than a stand-in
 * glyph, because the thing being named is an application people recognise on
 * sight. Nearly every book in a Calibre library carries the same mark, and a list of two hundred rows each spelling out "Calibre" is a
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
        <BookBadge
          key={mark.id}
          variant={variant}
          title={mark.title}
          className={mark.tone?.[variant]}
        >
          <mark.icon size={12} aria-hidden="true" />
          <span className="sr-only">{mark.label}</span>
        </BookBadge>
      ))}
    </span>
  );
}
