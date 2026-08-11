import { Star, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface StarRatingProps {
  /** Stars out of 5. 0 is unrated. Halves from Calibre are shown rounded. */
  value: number;
  /**
   * Set the rating. Given this, the stars become a control once the pointer
   * (or focus) is in them: they follow it, and clicking commits. Called with 0
   * to clear — from the × or from clicking the current rating again. Omit for
   * a read-only display.
   */
  onRate?: (rating: number) => void;
  /** Names the book in the stars' accessible labels ("Rate Dune 3 stars"). */
  label?: string;
  size?: number;
  className?: string;
}

const STARS = [1, 2, 3, 4, 5];

/** Six rays, evenly round the star. Enough to read as a burst at 11px. */
const RAY_ANGLES = [0, 60, 120, 180, 240, 300];

/** Long enough for the rays to finish and clear themselves off the DOM. */
const BURST_MS = 450;

/**
 * A rating as five stars, in the user accent: this is the reader's own verdict,
 * never the crowd's (docs/features/application-shell.md — the two accents).
 *
 * Interactive when given `onRate` — see docs/features/rating-a-book.md.
 */
export function StarRating({ value, onRate, label, size = 11, className }: StarRatingProps) {
  // The star being pointed at or focused, previewing what a click would set.
  const [preview, setPreview] = useState<number | null>(null);

  // The burst playing on a just-clicked star. The id restarts the animation
  // when the same star is clicked twice running — a remount, not a replay.
  const [burst, setBurst] = useState<{ star: number; id: number } | null>(null);
  const burstTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const burstId = useRef(0);

  useEffect(() => () => clearTimeout(burstTimer.current), []);

  function playBurst(star: number) {
    burstId.current += 1;
    setBurst({ star, id: burstId.current });
    clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(() => setBurst(null), BURST_MS);
  }

  const rating = clamp(value);

  if (!onRate) {
    if (rating === 0) return null;
    return (
      <span
        role="img"
        aria-label={`${rating} out of 5 stars`}
        className={cn("inline-flex items-center gap-px", className)}
      >
        {STARS.map((star) => (
          <Star key={star} size={size} className={starClass(star <= rating)} />
        ))}
      </span>
    );
  }

  const shown = preview ?? rating;

  return (
    <span
      className={cn(
        // No gap between the stars and the clear button: a dead strip between
        // them would read as "left the control" and flicker the preview off.
        // At rest this reads as the old read-only stars: only the earned ones
        // are visible. The empty stars and the × are transparent rather than
        // absent, so the control keeps its full width and entering it reveals
        // the affordance without moving anything a click is aimed at.
        "group/rating inline-flex w-fit items-center",
        className,
      )}
    >
      {/* A radio group, so arrow keys move through the five values and only one
          star is a tab stop — 255 books shouldn't cost 1275 of them. The clear
          button is deliberately outside it: a radio group holds radios. */}
      <span
        role="radiogroup"
        aria-label={label ? `Rating for ${label}` : "Rating"}
        // Leaving the stars drops the preview back to the committed value —
        // unless the pointer went on to the ×, which sets its own preview.
        onMouseLeave={() => setPreview(null)}
        className="inline-flex items-center gap-px"
      >
        {STARS.map((star) => {
          const filled = star <= shown;
          // Written to narrow `burst` below, not just to test it.
          const bursting = burst !== null && burst.star === star;
          return (
            // biome-ignore lint/a11y/useSemanticElements: a real radio can't clear itself — clicking the checked one fires no change event, and unrated is a state this control has to be able to reach.
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={star === rating}
              // Only the current rating is a tab stop; an unrated book offers its
              // first star instead, so the group is always reachable.
              tabIndex={star === (rating || 1) ? 0 : -1}
              aria-label={
                star === rating
                  ? `Clear the ${star}-star rating${label ? ` for ${label}` : ""}`
                  : `Rate ${label ? `${label} ` : ""}${star} star${star === 1 ? "" : "s"}`
              }
              onClick={(event) => {
                // In the table the whole row opens the book; rating one shouldn't.
                event.stopPropagation();
                const next = star === rating ? 0 : star;
                // Setting a rating is worth celebrating; clearing one isn't.
                if (next > 0) playBurst(star);
                onRate(next);
              }}
              onMouseEnter={() => setPreview(star)}
              onFocus={() => setPreview(star)}
              onBlur={() => setPreview(null)}
              onKeyDown={(event) => handleArrows(event, star)}
              className="focus-visible:ring-ring/50 relative cursor-pointer rounded-[2px] p-px focus-visible:ring-2 focus-visible:outline-none"
            >
              {/* Keyed by the burst id so clicking the same star again remounts
                this and replays the pop from the top. */}
              <span
                key={bursting ? burst.id : "idle"}
                className={cn(
                  "block",
                  bursting && "motion-safe:animate-[star-pop_400ms_var(--spring)]",
                )}
              >
                <Star
                  size={size}
                  className={cn(
                    starClass(filled),
                    // An empty star is invisible until the pointer (or focus)
                    // is in the control, then fades in outlined — that reveal
                    // is the whole "these are yours to set" signal.
                    !filled &&
                      "opacity-0 group-hover/rating:opacity-100 group-focus-within/rating:opacity-100",
                    "motion-safe:transition-all motion-safe:duration-150",
                  )}
                />
              </span>

              {bursting && (
                <span aria-hidden="true" className="pointer-events-none absolute inset-0">
                  {RAY_ANGLES.map((angle) => (
                    <span
                      key={angle}
                      style={{ "--angle": `${angle}deg` } as React.CSSProperties}
                      className="bg-you absolute top-1/2 left-1/2 h-[0.3rem] w-px rounded-full opacity-0 motion-safe:animate-[star-burst-ray_450ms_ease-out]"
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </span>

      {/* The width is always spent, rated or not, so earning a rating doesn't
          shove the row sideways. Rendered only when there's something to
          clear, and revealed with the rest of the control on hover. */}
      <span className="inline-flex items-center justify-center pl-1" style={{ width: size + 4 }}>
        {rating > 0 && (
          <button
            type="button"
            aria-label={`Clear the rating${label ? ` for ${label}` : ""}`}
            title="Clear rating"
            onClick={(event) => {
              event.stopPropagation();
              onRate(0);
            }}
            // Preview zero, not a star: pointing at the × means "none of them",
            // so the stars empty out to show what clicking would leave behind.
            onMouseEnter={() => setPreview(0)}
            onMouseLeave={() => setPreview(null)}
            onFocus={() => setPreview(0)}
            onBlur={() => setPreview(null)}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 cursor-pointer rounded-[2px] opacity-0 group-hover/rating:opacity-70 group-focus-within/rating:opacity-70 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none motion-safe:transition-opacity"
          >
            <X size={size} />
          </button>
        )}
      </span>
    </span>
  );
}

/** Calibre reports halves; we show whole stars and can only set whole ones. */
function clamp(value: number): number {
  return Math.round(Math.min(5, Math.max(0, value)));
}

const starClass = (filled: boolean) => (filled ? "fill-you text-you" : "text-line-strong");

/**
 * Roving focus across the five stars. The radio group's own semantics promise
 * arrow keys work; nothing provides them for free.
 */
function handleArrows(event: React.KeyboardEvent<HTMLButtonElement>, star: number) {
  const step = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : -1;
  if (!/^Arrow(Right|Left|Up|Down)$/.test(event.key)) return;

  const next = Math.min(5, Math.max(1, star + step));
  if (next === star) return;

  event.preventDefault();
  const group = event.currentTarget.parentElement;
  const target = group?.children[next - 1];
  if (target instanceof HTMLElement) target.focus();
}
