import { Download } from "lucide-react";
import { bookDownloadUrl, type LibraryBook, preferredFormat } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface BookDownloadButtonProps {
  book: Pick<LibraryBook, "calibreId" | "title" | "formats">;
  /**
   * Where it sits. `quiet` is on the canvas and flips with the theme; `overlay`
   * lies on top of a cover, which is an image in both themes, so it stays dark
   * glass regardless — the one place a fixed light-on-dark chip is correct.
   */
  variant?: "quiet" | "overlay";
  className?: string;
}

const VARIANTS = {
  quiet:
    "border-line-strong bg-fill text-muted-foreground hover:border-you hover:bg-you hover:text-primary-foreground",
  overlay: "border-white/20 bg-black/65 text-white hover:border-you hover:bg-you",
} as const;

/**
 * Hands over the book's file, straight from Calibre through the proxy — the one
 * thing still fetched live (ADR 0011). One format — the most portable one it
 * has — because a shelf affordance shouldn't open a menu; picking a different
 * one is the detail panel's job.
 *
 * Absent for a book with no formats, and for one that has left the Calibre
 * library: Grimoire keeps that book's record and cover, but the *file* was
 * always Calibre's, and there is nothing left to point at.
 *
 * Hidden until the book it belongs to is hovered, so callers must mark that
 * card or row `group/book`. Focus reveals it too — a pointer-only affordance
 * would be unreachable. See docs/features/book-list.md.
 */
export function BookDownloadButton({
  book,
  variant = "quiet",
  className,
}: BookDownloadButtonProps) {
  const format = preferredFormat(book.formats);
  if (!format || book.calibreId === null) return null;

  return (
    <a
      href={bookDownloadUrl(book.calibreId, format)}
      download
      title={`Download ${format}`}
      aria-label={`Download ${book.title} as ${format}`}
      // The card or row around this may itself be a target; downloading is not
      // the same as opening.
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "flex size-7 items-center justify-center rounded-full border backdrop-blur-md",
        VARIANTS[variant],
        "opacity-0 group-hover/book:opacity-100 focus-visible:opacity-100 motion-safe:transition-[opacity,color,background-color,border-color]",
        className,
      )}
    >
      <Download size={13} />
    </a>
  );
}
