import { useState } from "react";
import { finishedAtOf, type ReadDateChoice, ReadDatePicker } from "@/components/read-date-picker";
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
import { hardcoverStatusLabel, type LibraryBook } from "@/lib/api";

/**
 * What the confirm is holding: the book being rated, the stars to give it, and
 * where Hardcover has it — a status id for a shelved-but-unfinished book, null
 * for one not on their shelves at all.
 */
export interface PendingShelve {
  book: LibraryBook;
  rating: number;
  statusId: number | null;
}

/**
 * The ask before a rating changes a Hardcover shelf
 * (docs/features/rating-a-book.md). Two flavours of the same question: a book
 * not on the reader's shelves gets *added* as **Read**, a shelved one that
 * isn't finished — Want to Read, Currently Reading, Paused — gets *marked*
 * Read, or just rated if they'd rather leave the shelf alone. Both ask when it
 * was finished.
 */
export function HardcoverShelveDialog({
  pending,
  readerName,
  onConfirm,
  onJustRate,
  onCancel,
}: {
  pending: PendingShelve | null;
  /** Whose shelves it lands on. */
  readerName?: string;
  /** Shelve (or mark read) and rate. Fire-and-forget: the stars are already optimistic. */
  onConfirm: (finishedAt?: string) => void;
  /** Rate without touching the status — offered only for a shelved book. */
  onJustRate: () => void;
  onCancel: () => void;
}) {
  return (
    <AlertDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent>
        {pending && (
          <ShelveBody
            pending={pending}
            readerName={readerName}
            onConfirm={onConfirm}
            onJustRate={onJustRate}
          />
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ShelveBody({
  pending,
  readerName,
  onConfirm,
  onJustRate,
}: {
  pending: PendingShelve;
  readerName?: string;
  onConfirm: (finishedAt?: string) => void;
  onJustRate: () => void;
}) {
  const [readDate, setReadDate] = useState<ReadDateChoice>({ kind: "unknown" });
  const whose = readerName ? `${readerName}'s` : "your";
  const shelved = pending.statusId !== null;

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {shelved ? "Mark it as read?" : "Add it to your Hardcover shelves?"}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {shelved ? (
            <>
              “{pending.book.title}” is on {whose} Hardcover shelves as{" "}
              <span className="text-foreground">
                {hardcoverStatusLabel(pending.statusId as number)}
              </span>
              . Rating it can mark it as <span className="text-foreground">Read</span> — or just set
              the stars and leave the shelf as it is.
            </>
          ) : (
            <>
              “{pending.book.title}” isn't on {whose} Hardcover shelves yet. Rating it will add it
              as <span className="text-foreground">Read</span> — that's what rating a book means on
              hardcover.app — and then set the rating.
            </>
          )}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <ReadDatePicker value={readDate} onChange={setReadDate} />

      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        {shelved && (
          <AlertDialogAction variant="outline" onClick={onJustRate}>
            Just rate
          </AlertDialogAction>
        )}
        <AlertDialogAction onClick={() => onConfirm(finishedAtOf(readDate))}>
          {shelved ? "Mark read and rate" : "Add and rate"}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}
