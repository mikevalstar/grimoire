import { HardcoverIcon } from "@/components/brand-icons";
import type { SeriesRef } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * A book's series, in the details panel's header — one chip each, primary
 * first (ADR 0019). A chip carrying Hardcover's mark is one Calibre has no side
 * of, so the shelf is showing something the library itself does not.
 *
 * Falls back to the plain string for a book whose series has not been
 * reconciled into the tables yet, which is what the panel showed before this
 * and what a library sees between an upgrade and its next sync.
 *
 * See docs/features/setting-a-series-from-hardcover.md.
 */
export function BookSeriesChips({
  series,
  seriesIndex,
  seriesList,
  className,
}: {
  series: string | null;
  seriesIndex: number | null;
  seriesList: SeriesRef[];
  className?: string;
}) {
  if (seriesList.length === 0) {
    if (!series) return null;
    return (
      <p className={cn("text-you-soft text-[12px]", className)}>
        {series}
        {seriesIndex !== null && ` · Book ${seriesIndex}`}
      </p>
    );
  }

  return (
    <ul className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {seriesList.map((entry) => (
        <li
          key={entry.id}
          className={cn(
            "border-line flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
            // The primary is the one the shelf sorts and files by, so it is the
            // one that reads as a statement rather than as an aside.
            entry.primary ? "text-you-soft border-you-soft/30" : "text-muted-foreground",
          )}
        >
          {entry.source !== "calibre" && (
            <HardcoverIcon size={10} className="shrink-0 opacity-70" aria-hidden="true" />
          )}
          <span className="truncate">{entry.name}</span>
          {/* Their positions are floats, and #1.5 is a real answer — that is
              where novellas live — so the number is printed as given. */}
          {entry.position !== null && <span className="opacity-70">#{entry.position}</span>}
        </li>
      ))}
    </ul>
  );
}
