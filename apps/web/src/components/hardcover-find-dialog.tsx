import { Loader2 } from "lucide-react";
import { useState } from "react";
import { HardcoverBookSearch } from "@/components/hardcover-book-search";
import { finishedAtOf, type ReadDateChoice, ReadDatePicker } from "@/components/read-date-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { HardcoverSearchResult, LibraryBook } from "@/lib/api";
import { publicationYear } from "@/lib/publication";

/**
 * What the finder is holding: the book, and the stars to give it — or null
 * when it was the corner check that opened it, and the book is only being
 * marked read (docs/features/marking-a-book-read.md).
 */
export interface PendingFind {
  book: LibraryBook;
  rating: number | null;
}

/**
 * The finder (docs/features/rating-a-book.md): rating a Calibre-only book
 * while the reader's stars live on Hardcover means finding the book in
 * Hardcover's catalogue first. Picking a match adds it to their shelves as
 * **Read** — the footer says so — rates it, and joins it into this work, so
 * from then on it's one card with an ordinary Hardcover rating.
 */
export function HardcoverFindDialog({
  pending,
  readerName,
  search,
  onConfirm,
  onCancel,
}: {
  pending: PendingFind | null;
  /** Whose shelves the pick lands on. */
  readerName?: string;
  /** Run one catalogue search — the API route, injected so stories can stub it. */
  search: (query: string) => Promise<HardcoverSearchResult[]>;
  /**
   * Shelve, rate and link the picked book — `finishedAt` is the reader's
   * finished-when at its own precision, absent for "I don't know". Resolves
   * when it lands; rejects with something worth showing — the finder stays
   * open until it settles.
   */
  onConfirm: (hardcoverBookId: number, finishedAt?: string) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <Dialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      {/* Radix only mounts this while open, so the search starts fresh from
          the book's own title every time. */}
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-lg">
        {pending && (
          <FinderBody
            pending={pending}
            readerName={readerName}
            search={search}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FinderBody({
  pending,
  readerName,
  search,
  onConfirm,
  onCancel,
}: {
  pending: PendingFind;
  readerName?: string;
  search: (query: string) => Promise<HardcoverSearchResult[]>;
  onConfirm: (hardcoverBookId: number, finishedAt?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const { book, rating } = pending;

  const [picked, setPicked] = useState<HardcoverSearchResult | null>(null);
  const [readDate, setReadDate] = useState<ReadDateChoice>({ kind: "unknown" });
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!picked) return;
    setConfirming(true);
    setError(null);
    try {
      await onConfirm(picked.id, finishedAtOf(readDate));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setConfirming(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Find it on Hardcover</DialogTitle>
        <DialogDescription>
          “{book.title}” isn't on Hardcover here yet. Pick the matching book to{" "}
          {rating === null ? "mark it read" : "rate it"} —
          {readerName ? ` ${readerName}'s` : " your"}{" "}
          {rating === null ? "read state lives" : "stars live"} on Hardcover.
        </DialogDescription>
      </DialogHeader>

      <HardcoverBookSearch
        // Seeded with the title minus any subtitle — ":" onwards is what most
        // often keeps the catalogue from matching.
        initialQuery={book.title.replace(/:.*$/, "").trim()}
        search={search}
        picked={picked?.id ?? null}
        onPick={setPicked}
      />

      {/* Asked only once a book is picked — before that it's noise under the
          results, and the answer belongs to a specific book. */}
      {picked && (
        <ReadDatePicker
          value={readDate}
          onChange={setReadDate}
          // The picked edition is the one being shelved, so its release year
          // bounds the answer; Calibre's date is the fallback.
          publishedYear={picked.releaseYear ?? publicationYear(book.published)}
          className="border-line border-t pt-3"
        />
      )}

      {error && <p className="text-destructive text-[12px]">{error}</p>}

      <DialogFooter className="items-center gap-3 sm:justify-between">
        <p className="text-muted-foreground text-[11px]">
          Adding puts it on {readerName ? `${readerName}'s` : "your"} Hardcover shelves as{" "}
          <span className="text-foreground">Read</span>.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={confirming}>
            Cancel
          </Button>
          <Button onClick={() => void confirm()} disabled={!picked || confirming}>
            {confirming && <Loader2 className="animate-spin" />}
            {rating === null ? "Add as read" : `Add and rate ${rating}★`}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
