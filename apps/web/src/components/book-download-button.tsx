import { Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { bookDownloadUrl, type LibraryBook, orderedFormats } from "@/lib/api";
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
 * thing still fetched live (ADR 0011).
 *
 * With one format it *is* the download. With several it opens a menu of them,
 * most portable first, because handing a reader an EPUB when they came for the
 * PDF is the wrong guess to make silently — and the picker costs a click only
 * for the books that actually have a choice.
 *
 * Absent for a book with no formats, and for one that has left the Calibre
 * library: Grimoire keeps that book's record and cover, but the *file* was
 * always Calibre's, and there is nothing left to point at.
 *
 * Hidden until the book it belongs to is hovered, so callers must mark that
 * card or row `group/book`. Focus reveals it too — a pointer-only affordance
 * would be unreachable — and so does an open menu, which outlives the hover
 * that opened it. See docs/features/book-list.md.
 */
export function BookDownloadButton({
  book,
  variant = "quiet",
  className,
}: BookDownloadButtonProps) {
  const formats = orderedFormats(book.formats);
  const { calibreId } = book;
  if (formats.length === 0 || calibreId === null) return null;

  const chrome = cn(
    "flex size-7 items-center justify-center rounded-full border backdrop-blur-md",
    VARIANTS[variant],
    // `data-[state=open]` because the pointer leaves the card to reach the menu:
    // without it the button — and the menu's anchor — fades out underneath it.
    "opacity-0 group-hover/book:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 motion-safe:transition-[opacity,color,background-color,border-color]",
    className,
  );

  // The card or row around this may itself be a target; downloading, or opening
  // the picker, is not the same as opening the book.
  const stopPropagation = (event: { stopPropagation: () => void }) => event.stopPropagation();

  if (formats.length === 1) {
    const format = formats[0];
    return (
      <a
        href={bookDownloadUrl(calibreId, format)}
        download
        title={`Download ${format}`}
        aria-label={`Download ${book.title} as ${format}`}
        onClick={stopPropagation}
        className={chrome}
      >
        <Download size={13} />
      </a>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title={`Download — ${formats.join(", ")}`}
        aria-label={`Download ${book.title} — choose a format`}
        onClick={stopPropagation}
        className={chrome}
      >
        <Download size={13} />
      </DropdownMenuTrigger>
      {/* Follows the button it hangs off: centred under the cover in the grid,
          and pulled back from the right edge in the table, where the actions
          column is the last thing in the row. */}
      <DropdownMenuContent
        align={variant === "overlay" ? "center" : "end"}
        className="min-w-36"
        onClick={stopPropagation}
      >
        <DropdownMenuLabel className="text-muted-foreground text-[11px] font-normal">
          Download as
        </DropdownMenuLabel>
        {formats.map((format) => (
          // asChild so each choice is a real link: it keeps the browser's own
          // "save as", and middle-click and right-click still behave.
          <DropdownMenuItem key={format} asChild>
            <a href={bookDownloadUrl(calibreId, format)} download>
              {format}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
