import { Layers2 } from "lucide-react";
import { useRef, useState } from "react";
import { BookCover } from "@/components/book-cover";
import { tooltipProps } from "@/components/ui/tooltip";
import { bookCoverUrl, coverSizeFor, type LibraryBook } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface BookCoverStackProps {
  book: LibraryBook;
  /** Roughly how wide the cover will be drawn, in CSS pixels. */
  width?: number;
  /**
   * Choose another of the work's covers, by member id. Without it the stack is
   * a picture rather than a control — and a work with one cover always is.
   */
  onChoose?: (bookId: number) => void;
  className?: string;
}

/** A few degrees each, alternating, so a stack of three doesn't fan one way. */
const TILT = [-5, 4, -3, 6];

const tiltAt = (index: number) => TILT[index % TILT.length] ?? 0;

/**
 * The last swap, which is what the two animations are hung off. Never cleared:
 * a CSS animation replays when its element remounts, and the `id` in the keys
 * below is what remounts them — so there is no timer here, and nothing to tidy
 * up when the animation ends.
 */
interface Swap {
  id: number;
  /** The sheet that left the top, and is on its way to the back of the pile. */
  outgoing: number;
  /** The tilt the sheet coming up was sitting at before it was chosen. */
  incomingFrom: number;
}

/**
 * A work's covers as a stack of papers: the chosen one face up, the others
 * showing a corner behind it. Clicking turns the next one over — the top sheet
 * flicks aside and drops to the back while the next rises to face up.
 *
 * A work only has more than one cover when [matching](docs/features/book-matching.md)
 * grouped members that each brought one — the same book from Calibre and from
 * hardcover.app, in two editions with two jackets. Which one to show was
 * decided by a rule until now; this is how it becomes a decision, and it is
 * stored per *work*, not per reader (docs/features/book-details-panel.md).
 */
export function BookCoverStack({ book, width = 104, onChoose, className }: BookCoverStackProps) {
  const [swap, setSwap] = useState<Swap | null>(null);
  const swapId = useRef(0);

  const { covers } = book;
  const current = covers.findIndex((cover) => cover.bookId === book.coverBookId);
  const chosen = covers[current === -1 ? 0 : current];

  // Nothing to swap between: the plain cover, and no affordance suggesting one.
  if (!onChoose || covers.length < 2 || !chosen) {
    return <BookCover book={book} width={width} className={className} />;
  }

  const next = covers[(Math.max(current, 0) + 1) % covers.length];
  const behind = covers.filter((cover) => cover.bookId !== chosen.bookId);
  const url = (bookId: number) => bookCoverUrl(book.id, coverSizeFor(width), bookId);

  function choose() {
    // Re-checked rather than relied on from the early return above: a closure
    // doesn't inherit the narrowing that got us past it.
    if (!next || !chosen || !onChoose) return;

    // Measured before the swap, while the sheet coming up is still behind: it
    // animates *from* where it is now, and the tilt it lands on afterwards is
    // whatever slot the outgoing sheet takes, which the render below computes.
    swapId.current += 1;
    setSwap({
      id: swapId.current,
      outgoing: chosen.bookId,
      incomingFrom: tiltAt(behind.findIndex((cover) => cover.bookId === next.bookId)),
    });
    onChoose(next.bookId);
  }

  return (
    <button
      type="button"
      onClick={choose}
      {...tooltipProps(`Show the ${sourceName(next?.source)} cover`)}
      aria-label={`Show the ${sourceName(next?.source)} cover of ${book.title}`}
      className={cn(
        "group/stack focus-visible:ring-ring/50 relative block shrink-0 rounded-md focus-visible:ring-[3px] focus-visible:outline-none",
        className,
      )}
      style={{ width }}
    >
      {/* The ones underneath, tilted from the bottom edge so they read as sheets
          on a desk rather than as a broken layout. They lean out further when
          the stack is pointed at, which is the whole "there's more than one
          here" signal — and it moves nothing the click is aimed at, since the
          click target is the stack itself. */}
      {behind.map((cover, index) => {
        const tilt = tiltAt(index);
        // The sheet that just left the top: it flies to this slot rather than
        // appearing in it. Keyed by the swap so a second click replays it.
        const leaving = swap?.outgoing === cover.bookId;
        return (
          <span
            key={leaving ? `${cover.bookId}-${swap.id}` : cover.bookId}
            aria-hidden="true"
            className={cn(
              "ease-spring absolute inset-0 origin-bottom brightness-75 transition-transform duration-300 group-hover/stack:scale-[1.02]",
              leaving && "motion-safe:animate-[cover-to-back_420ms_var(--spring)]",
            )}
            style={
              {
                transform: `rotate(${tilt}deg)`,
                zIndex: behind.length - index,
                "--tilt": `${tilt}deg`,
              } as React.CSSProperties
            }
          >
            <BookCover book={book} src={url(cover.bookId)} className="shadow-lg" />
          </span>
        );
      })}

      <span
        // Keyed by the swap so the rise replays from the top every time.
        key={swap ? swap.id : "top"}
        className={cn(
          "relative z-10 block origin-bottom",
          swap && "motion-safe:animate-[cover-to-front_420ms_var(--spring)]",
        )}
        style={{ "--tilt": `${swap?.incomingFrom ?? 0}deg` } as React.CSSProperties}
      >
        <BookCover book={book} src={url(chosen.bookId)} className="shadow-xl" />
      </span>

      {/* How many there are, and where to click. Dark glass in both themes —
          it lies on a cover, like every other mark on one. */}
      <span className="absolute right-1 bottom-1 z-20 inline-flex items-center gap-1 rounded border border-white/20 bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white/85 backdrop-blur-md">
        <Layers2 size={11} aria-hidden="true" />
        {covers.length}
      </span>
    </button>
  );
}

/** Source ids are lowercase words; a label is the same word with a capital. */
function sourceName(source: string | undefined): string {
  if (!source) return "other";
  return source.charAt(0).toUpperCase() + source.slice(1);
}
