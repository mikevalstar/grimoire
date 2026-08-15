import type { ReactNode } from "react";
import { ViewSwitcher } from "@/components/view-switcher";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/lib/view-mode";

export interface LibraryToolbarProps {
  /** Books currently shown. Omitted while the library is still loading. */
  bookCount?: number;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  /** The filter and ordering controls shown on the left. */
  children?: ReactNode;
  className?: string;
}

/**
 * The row above the library: filters on the left, the count and the view
 * switcher on the right. See docs/features/book-list.md.
 */
export function LibraryToolbar({
  bookCount,
  view,
  onViewChange,
  children,
  className,
}: LibraryToolbarProps) {
  return (
    <div className={cn("relative flex h-11 shrink-0 items-start gap-3", className)}>
      {children ?? (
        // Deliberately empty, but present: filters land here, and the library
        // shouldn't jump down the page when they do.
        <div className="border-line text-muted-foreground/60 flex h-full min-w-0 flex-1 items-center rounded-lg border border-dashed px-3 text-[11px] tracking-wide">
          Filters land here
        </div>
      )}

      {bookCount !== undefined && (
        <p className="text-muted-foreground shrink-0 text-[11px] tracking-wide tabular-nums uppercase">
          {bookCount.toLocaleString()} {bookCount === 1 ? "book" : "books"}
        </p>
      )}

      <ViewSwitcher view={view} onViewChange={onViewChange} className="shrink-0" />

      {/* A quiet boundary rather than a full-width hard rule: the controls
          belong to the shelf, but the first row should not crowd them. */}
      <span
        aria-hidden="true"
        className="via-line-strong/60 pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent to-transparent"
      />
    </div>
  );
}
