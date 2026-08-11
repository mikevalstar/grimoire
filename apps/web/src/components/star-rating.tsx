import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StarRatingProps {
  /** Stars out of 5. 0 renders nothing — an unrated book says so by staying quiet. */
  value: number;
  size?: number;
  className?: string;
}

/**
 * A rating as five stars, in the user accent: this is the reader's own verdict,
 * never the crowd's (docs/features/application-shell.md — the two accents).
 */
export function StarRating({ value, size = 11, className }: StarRatingProps) {
  const stars = Math.round(Math.min(5, Math.max(0, value)));
  if (stars === 0) return null;

  return (
    <span
      role="img"
      aria-label={`${stars} out of 5 stars`}
      className={cn("inline-flex items-center gap-px", className)}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          // biome-ignore lint/suspicious/noArrayIndexKey: five fixed stars, never reordered
          key={i}
          size={size}
          className={i < stars ? "fill-you text-you" : "text-line-strong"}
        />
      ))}
    </span>
  );
}
