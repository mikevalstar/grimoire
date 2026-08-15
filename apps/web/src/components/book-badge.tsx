import type { ReactNode } from "react";
import { tooltipProps } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface BookBadgeProps {
  /** Where it sits: over a cover image, or on the canvas beside a title. */
  variant?: "overlay" | "inline";
  /**
   * Hover text — the room a ten-pixel badge doesn't have to explain itself.
   * Goes to the app's shared tooltip, never to the accessible name: that
   * belongs to whatever the badge draws inside itself.
   */
  title?: string;
  children: ReactNode;
  className?: string;
}

/**
 * The shared shell for the small marks that sit on a book: same size, same
 * weight, same behaviour over a cover. What a badge *says* belongs to the badge
 * — this only makes them all look like the same kind of thing.
 */
export function BookBadge({ variant = "inline", title, children, className }: BookBadgeProps) {
  return (
    <span
      {...tooltipProps(title)}
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide whitespace-nowrap",
        variant === "overlay"
          ? // On top of a cover, which is an image in both themes — so this one
            // stays dark glass rather than following the theme.
            "border-white/20 bg-black/65 text-white/85 backdrop-blur-md"
          : "border-line bg-fill text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
