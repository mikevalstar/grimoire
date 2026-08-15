import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The dog-ear (docs/features/marking-a-book-read.md): a cut-off triangle in a
 * cover's bottom-right corner carrying a check. A read book wears it filled in
 * the user accent; an unread book reveals a quiet one on hover or focus — the
 * shelf's rule: nothing on hover a keyboard can't reach.
 *
 * Clicking never flips anything by itself — the owner opens the confirm modal.
 */
export function ReadCorner({
  read,
  onToggle,
  label,
  className,
}: {
  read: boolean;
  /** Open the confirm for the *other* state. Omit for a read-only corner. */
  onToggle?: (read: boolean) => void;
  /** Names the book in the accessible label. */
  label?: string;
  className?: string;
}) {
  const forBook = label ? ` "${label}"` : "";

  if (!onToggle) {
    if (!read) return null;
    return (
      <span
        role="img"
        aria-label={`${label ?? "This book"} is read`}
        className={cn(corner, "bg-you", className)}
      >
        <Check size={13} strokeWidth={3} className="absolute right-0.5 bottom-0.5 text-white" />
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={read}
      aria-label={read ? `Mark${forBook} as unread` : `Mark${forBook} as read`}
      onClick={(event) => {
        // In the grid the cover behind opens the book; the corner shouldn't.
        event.stopPropagation();
        onToggle(!read);
      }}
      className={cn(
        corner,
        "focus-visible:ring-ring/70 cursor-pointer focus-visible:ring-2 focus-visible:outline-none",
        read
          ? "bg-you text-white"
          : // Invisible until the card is hovered or the corner is focused —
            // then a quiet glass wedge, the same reveal the stars use.
            "text-white/90 bg-black/55 opacity-0 backdrop-blur-sm transition-opacity group-hover/book:opacity-100 focus-visible:opacity-100 hover:bg-black/70",
        className,
      )}
    >
      <Check size={13} strokeWidth={3} className="absolute right-0.5 bottom-0.5" />
    </button>
  );
}

/** The wedge itself: a bottom-right triangle, clipped, hugging the cover's corner. */
const corner =
  "absolute right-0 bottom-0 block size-9 rounded-br-md [clip-path:polygon(100%_0,100%_100%,0_100%)]";
