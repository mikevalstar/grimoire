import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One number with a name, for the small stat rows in settings — sync counts,
 * shelf sizes. A tile is glanceable where a definition list is a read.
 */
export function StatTile({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  /** A quieter line under the value — "4 minutes ago", "no longer in Calibre". */
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-line bg-fill grid content-start gap-0.5 rounded-lg border px-3 py-2",
        className,
      )}
    >
      <span className="text-muted-foreground text-[10px] tracking-wide uppercase">{label}</span>
      <span className="text-[15px] font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-muted-foreground text-[11px]">{hint}</span>}
    </div>
  );
}
