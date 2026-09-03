import { ImageDown, ListOrdered, Loader2, Settings2, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  /**
   * Delete this work's uploaded entries and their files
   * (docs/features/uploading-a-book.md). Undefined leaves the item disabled —
   * a Calibre or Hardcover book has nothing of Grimoire's to delete, and a
   * sync would bring it back if it had.
   */
  onDeleteUpload?: () => Promise<void>;
  /** Named in the delete confirmation, so the reader sees what is about to go. */
  bookTitle?: string;
  className?: string;
}

/**
 * The gear at the end of the details panel's footer: the operations that act on
 * the open book, as opposed to everything above it, which is a read-out or a
 * reader's own opinion. See docs/features/book-actions.md.
 */
export function BookActionsMenu({
  onRefetchCover,
  onSetSeries,
  onDeleteUpload,
  bookTitle,
  className,
}: BookActionsMenuProps) {
  const [state, setState] = useState<RunState>("idle");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function deleteUpload() {
    if (!onDeleteUpload || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteUpload();
      setConfirmingDelete(false);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete the file.");
    } finally {
      setDeleting(false);
    }
  }

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
    <>
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

          {/* Hands off to a confirmation the same way, since a file on disk is
            the one thing here that cannot be fetched again. */}
          <DropdownMenuItem
            disabled={!onDeleteUpload}
            onSelect={() => setConfirmingDelete(true)}
            className="text-destructive data-[highlighted]:text-destructive"
          >
            <Trash2 size={14} aria-hidden="true" />
            Delete uploaded book…
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

      <AlertDialog
        open={confirmingDelete}
        onOpenChange={(open) => {
          if (!deleting) setConfirmingDelete(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete the uploaded file?</AlertDialogTitle>
            <AlertDialogDescription>
              {bookTitle ? <>“{bookTitle}”</> : "This book"}’s uploaded file will be removed from
              Grimoire’s disk. Copies in Calibre or on Hardcover stay where they are; if this file
              was the only copy, the book leaves the shelf along with its ratings and read dates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-destructive text-[12px]" role="alert">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                // Stays open until the delete has landed, so a failure has
                // somewhere to be shown.
                event.preventDefault();
                void deleteUpload();
              }}
            >
              {deleting ? "Deleting…" : "Delete file"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
