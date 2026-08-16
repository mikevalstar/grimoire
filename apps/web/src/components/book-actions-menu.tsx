import { ImageDown, ListOrdered, Loader2, Settings2 } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { tooltipProps } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** How a run ended, as the menu reports it back. */
type RunState = "idle" | "running" | "done" | "empty" | "failed";

export interface BookActionsMenuProps {
  /**
   * Fetch this book's covers again, from every source it has, and overwrite
   * them. Resolves with how many members produced a file, so a run that found
   * nothing can say so. Undefined leaves the item disabled rather than gone —
   * an empty menu is worse than one that says what it would do
   * (docs/features/book-actions.md).
   */
  onRefetchCover?: () => Promise<{ attempted: number; fetched: number }>;
  /**
   * Open the set-series dialog
   * (docs/features/setting-a-series-from-hardcover.md). Undefined leaves the
   * item disabled — which is what a reader with no linked Hardcover account
   * gets, since asking their catalogue needs their token.
   */
  onSetSeries?: () => void;
  className?: string;
}

/**
 * The gear at the end of the details panel's footer: the operations that act on
 * the open book, as opposed to everything above it, which is a read-out or a
 * reader's own opinion. See docs/features/book-actions.md.
 */
export function BookActionsMenu({ onRefetchCover, onSetSeries, className }: BookActionsMenuProps) {
  const [state, setState] = useState<RunState>("idle");

  async function refetchCover() {
    if (!onRefetchCover || state === "running") return;
    setState("running");
    try {
      const { fetched } = await onRefetchCover();
      setState(fetched > 0 ? "done" : "empty");
    } catch {
      setState("failed");
    }
  }

  return (
    <DropdownMenu
      // Last run's outcome is about the menu that was open when it happened;
      // opening it again is a fresh question.
      onOpenChange={(open) => {
        if (open && state !== "running") setState("idle");
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Actions"
          {...tooltipProps("Actions", "top")}
          className={cn(
            "text-muted-foreground hover:text-foreground hover:bg-fill flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
            className,
          )}
        >
          {state === "running" ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : (
            <Settings2 size={15} aria-hidden="true" />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          disabled={!onRefetchCover || state === "running"}
          // The menu stays open: the fetch takes a moment and its outcome is
          // reported here, which needs somewhere to still be on screen.
          onSelect={(event) => {
            event.preventDefault();
            void refetchCover();
          }}
        >
          {state === "running" ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <ImageDown size={14} aria-hidden="true" />
          )}
          Re-fetch cover
        </DropdownMenuItem>

        {/* Unlike the re-fetch above, this one hands off to a dialog, so the
            menu closes behind it in the ordinary way. */}
        <DropdownMenuItem disabled={!onSetSeries} onSelect={() => onSetSeries?.()}>
          <ListOrdered size={14} aria-hidden="true" />
          Set series…
        </DropdownMenuItem>

        {state !== "idle" && state !== "running" && (
          <p className="text-muted-foreground px-2 py-1.5 text-[11px] leading-snug" role="status">
            {state === "done"
              ? "Cover re-fetched."
              : state === "empty"
                ? "No source had a cover to give."
                : "Could not re-fetch the cover."}
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
