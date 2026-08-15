import { useState } from "react";
import { finishedAtOf, type ReadDateChoice, ReadDatePicker } from "@/components/read-date-picker";
import { StarRating } from "@/components/star-rating";
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
import type { LibraryBook } from "@/lib/api";
import { publicationYear } from "@/lib/publication";

/** What the corner's confirm is holding (docs/features/marking-a-book-read.md). */
export interface PendingReadState {
  book: LibraryBook;
  /** The state being confirmed into — true marks read, false unmarks. */
  read: boolean;
  /**
   * Where the book sits when the reader's read state lives on Hardcover:
   * already shelved, or about to be added. Null means the local store.
   */
  shelfState: "shelved" | "unshelved" | null;
  /** The reader's current rating, 0 for none — drives the unmark question. */
  currentRating: number;
  /**
   * Whether rating side effects may be offered at all — only when the rating
   * source matches the read-state source, so nothing lands in the other store.
   */
  offerRating: boolean;
}

/** The confirm's answer: the finished-when and the optional rating effects. */
export interface ReadStateAnswer {
  finishedAt?: string;
  rating?: number;
  removeRating?: boolean;
}

/**
 * The corner check's confirm (docs/features/marking-a-book-read.md) — always
 * shown, both directions. Marking asks when the book was finished and offers
 * an optional rating; unmarking says what happens on Hardcover (back to Want
 * to Read) and, where a rating exists, asks whether it goes too.
 */
export function ReadStateDialog({
  pending,
  readerName,
  onConfirm,
  onCancel,
}: {
  pending: PendingReadState | null;
  /** Whose book it is. */
  readerName?: string;
  /** Apply it. Fire-and-forget: the corner is already optimistic. */
  onConfirm: (answer: ReadStateAnswer) => void;
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
        {pending && <Body pending={pending} readerName={readerName} onConfirm={onConfirm} />}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Body({
  pending,
  readerName,
  onConfirm,
}: {
  pending: PendingReadState;
  readerName?: string;
  onConfirm: (answer: ReadStateAnswer) => void;
}) {
  const [readDate, setReadDate] = useState<ReadDateChoice>({ kind: "unknown" });
  const [rating, setRating] = useState(0);

  const { book, read, shelfState, currentRating, offerRating } = pending;
  const whose = readerName ? `${readerName}'s` : "your";

  if (read) {
    return (
      <>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark it as read?</AlertDialogTitle>
          <AlertDialogDescription>
            {shelfState === null ? (
              <>“{book.title}” will be remembered as read, here in Grimoire.</>
            ) : shelfState === "shelved" ? (
              <>
                “{book.title}” will move to <span className="text-foreground">Read</span> on {whose}{" "}
                Hardcover shelves.
              </>
            ) : (
              <>
                “{book.title}” isn't on {whose} Hardcover shelves yet — it will be added as{" "}
                <span className="text-foreground">Read</span>.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ReadDatePicker
          value={readDate}
          onChange={setReadDate}
          publishedYear={publicationYear(book.published)}
        />

        {/* Only when the stars would land in the same store, and only for a
            book they haven't already rated — this is a shortcut, not an edit. */}
        {offerRating && currentRating === 0 && (
          <div className="grid gap-2">
            <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
              Rate it too — optional
            </p>
            <StarRating value={rating} onRate={setRating} revealed size={18} label={book.title} />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              onConfirm({
                finishedAt: finishedAtOf(readDate),
                rating: rating > 0 ? rating : undefined,
              })
            }
          >
            Mark as read
          </AlertDialogAction>
        </AlertDialogFooter>
      </>
    );
  }

  const askAboutRating = offerRating && currentRating > 0;

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>Mark it as unread?</AlertDialogTitle>
        <AlertDialogDescription>
          {shelfState === null ? (
            <>“{book.title}” will go back to unread.</>
          ) : (
            <>
              A Hardcover shelf always says <em>something</em> — “{book.title}” will go back to{" "}
              <span className="text-foreground">Want to Read</span> on {whose} shelves.
            </>
          )}
          {askAboutRating && (
            <>
              {" "}
              It carries {readerName ? `${readerName}'s` : "your"}{" "}
              <span className="text-foreground">{currentRating}-star</span> rating — keep it, or
              remove it as well.
            </>
          )}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        {askAboutRating ? (
          <>
            <AlertDialogAction variant="outline" onClick={() => onConfirm({ removeRating: true })}>
              Remove it as well
            </AlertDialogAction>
            <AlertDialogAction onClick={() => onConfirm({ removeRating: false })}>
              Keep the rating
            </AlertDialogAction>
          </>
        ) : (
          <AlertDialogAction onClick={() => onConfirm({})}>Mark as unread</AlertDialogAction>
        )}
      </AlertDialogFooter>
    </>
  );
}
