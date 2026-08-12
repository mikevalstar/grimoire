import { LibraryBig } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BookMissingBadgeProps {
  /** Where it sits: over a cover image, or on the canvas beside a title. */
  variant?: "overlay" | "inline";
  className?: string;
}

const LABEL = "No longer in Calibre";
const TITLE =
  "Grimoire still has this book's details, cover and your rating, but Calibre no longer lists it — so there is no file to download.";

/**
 * Marks a book Grimoire keeps but Calibre has dropped (ADR 0011). Sync never
 * deletes a book, so these accumulate quietly; the badge is what stops that
 * looking like a bug when the download button is missing.
 *
 * Deliberately muted rather than a warning colour: nothing is broken, and this
 * is not the reader's problem to fix. See docs/features/calibre-sync.md.
 */
export function BookMissingBadge({ variant = "inline", className }: BookMissingBadgeProps) {
  return (
    <span
      title={TITLE}
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1 py-px text-[9px] font-semibold tracking-wide whitespace-nowrap",
        variant === "overlay"
          ? // On top of a cover, which is an image in both themes — so this one
            // stays dark glass rather than following the theme.
            "border-white/20 bg-black/65 text-white/85 backdrop-blur-md"
          : "border-line bg-fill text-muted-foreground",
        className,
      )}
    >
      <LibraryBig size={9} aria-hidden="true" />
      {LABEL}
    </span>
  );
}
