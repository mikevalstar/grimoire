import { ChevronDown, Download } from "lucide-react";
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
   * `panel` is the labelled, always-visible one in the
   * [details panel](../../../../docs/features/book-details-panel.md), where
   * downloading is the screen's own action rather than a card's.
   */
  variant?: "quiet" | "overlay" | "panel";
  className?: string;
}

const VARIANTS = {
  quiet: {
    chrome:
      "size-7 rounded-full border-line-strong bg-fill text-muted-foreground backdrop-blur-md hover:border-you hover:bg-you hover:text-primary-foreground",
    /** Hidden until the card or row around it is hovered. */
    onHover: true,
  },
  overlay: {
    chrome:
      "size-7 rounded-full border-white/20 bg-black/65 text-white backdrop-blur-md hover:border-you hover:bg-you",
    onHover: true,
  },
  panel: {
    chrome:
      "h-9 gap-2 rounded-lg border-transparent bg-you px-4 text-[13px] font-semibold text-primary-foreground shadow-[0_4px_20px_-4px_var(--you-glow)] hover:brightness-110",
    onHover: false,
  },
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
 * On a card or a row it is hidden until that book is hovered, so callers must
 * mark the card or row `group/book`. Focus reveals it too — a pointer-only
 * affordance would be unreachable — and so does an open menu, which outlives
 * the hover that opened it. The `panel` variant is always visible: the details
 * panel is already about one book, so there is nothing to reveal it against.
 * See docs/features/book-list.md and docs/features/book-details-panel.md.
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
    "flex items-center justify-center border motion-safe:transition-[opacity,color,background-color,border-color]",
    VARIANTS[variant].chrome,
    // `data-[state=open]` because the pointer leaves the card to reach the menu:
    // without it the button — and the menu's anchor — fades out underneath it.
    VARIANTS[variant].onHover &&
      "opacity-0 group-hover/book:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
    className,
  );

  // The panel has room to say what the button does, and only one format to name.
  const label = variant === "panel" && (
    <span>{formats.length === 1 ? `Download ${formats[0]}` : "Download"}</span>
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
        {label}
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
        {label}
        {label && <ChevronDown size={12} className="opacity-70" />}
      </DropdownMenuTrigger>
      {/* Follows the button it hangs off: centred under the cover in the grid,
          pulled back from the right edge in the table, where the actions column
          is the last thing in the row, and left-aligned under the wide button
          in the panel. */}
      <DropdownMenuContent
        align={variant === "overlay" ? "center" : variant === "panel" ? "start" : "end"}
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
