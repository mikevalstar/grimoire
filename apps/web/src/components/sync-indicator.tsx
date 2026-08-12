import { RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SyncStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface SyncIndicatorProps {
  status?: SyncStatus;
  onSync?: () => void;
  className?: string;
}

/** "4 minutes ago" — relative, because the exact minute matters less than the age. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const seconds = Math.round((now - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(seconds)) return "at an unknown time";
  if (seconds < 45) return "just now";

  const units: [limit: number, per: number, name: string][] = [
    [3600, 60, "minute"],
    [86400, 3600, "hour"],
    [2592000, 86400, "day"],
    [Infinity, 2592000, "month"],
  ];
  for (const [limit, per, name] of units) {
    if (seconds < limit) {
      const value = Math.round(seconds / per);
      return `${value} ${name}${value === 1 ? "" : "s"} ago`;
    }
  }
  return "a long time ago";
}

const PHASE_LABELS = {
  mirror: "Reading Calibre",
  reconcile: "Updating the library",
  covers: "Fetching covers",
  idle: "Syncing",
} as const;

/** What the tooltip says, which in the failed case is the whole point of the control. */
export function syncTooltip(status: SyncStatus | undefined, now?: number): string {
  if (!status) return "Sync with Calibre";

  if (status.running) {
    const progress = status.progress;
    const label = PHASE_LABELS[progress?.phase ?? "idle"];
    if (progress?.total) return `${label}, ${progress.done} of ${progress.total}`;
    return `${label}…`;
  }

  if (status.lastStatus === "error" && status.lastError) {
    return status.lastErrorHint
      ? `${status.lastError}\n\n${status.lastErrorHint}`
      : status.lastError;
  }

  if (!status.configured) return "No Calibre server configured yet — see Settings.";
  if (!status.lastCompletedAt) return "Never synced. Click to sync now.";
  return `Last synced ${relativeTime(status.lastCompletedAt, now)}. Click to sync now.`;
}

/**
 * The header's sync control: says whether Grimoire's copy of the library is
 * current, and starts a sync when clicked.
 *
 * Three states — idle, running, failed. A failure stays red until a sync
 * succeeds, so one at 3am is still visible at 9am, and the tooltip carries the
 * real error rather than a generic "sync failed". Unlike the gear, this stays
 * visible on a phone, because it is also the error surface.
 *
 * See docs/features/calibre-sync.md.
 */
export function SyncIndicator({ status, onSync, className }: SyncIndicatorProps) {
  const running = status?.running ?? false;
  const failed = !running && status?.lastStatus === "error";
  const tooltip = syncTooltip(status);

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        // Clicking during a sync would only join the run already in flight, so
        // the control goes quiet rather than pretending a second one starts.
        // `aria-disabled` rather than `disabled`, because a disabled button
        // takes no pointer events — and mid-sync is exactly when the tooltip's
        // progress is worth reading.
        onClick={running ? undefined : onSync}
        aria-disabled={running}
        aria-label={tooltip}
        aria-live="polite"
        className={cn(
          "flex size-8 items-center justify-center rounded-lg border transition-colors",
          failed
            ? "border-destructive/40 bg-destructive/10 text-destructive hover:border-destructive/70"
            : "border-line bg-fill text-muted-foreground hover:border-line-strong hover:text-foreground",
          running && "cursor-default",
          className,
        )}
      >
        <RefreshCw
          size={14}
          className={cn(
            // Rotation is motion-safe only; reduced-motion users get the pulse
            // instead, so "something is happening" is never carried by movement
            // alone.
            running && "motion-safe:animate-spin motion-reduce:animate-pulse",
          )}
        />
      </TooltipTrigger>
      {/* The failure text is two paragraphs — error, then hint — so the blank
          line in it has to survive, and the box needs room to wrap. */}
      <TooltipContent side="bottom" sideOffset={6} className="max-w-72 whitespace-pre-line">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
