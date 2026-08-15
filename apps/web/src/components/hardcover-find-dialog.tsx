import { BookOpen, Loader2, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import type { HardcoverSearchResult, LibraryBook } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * What the finder is holding: the book, and the stars to give it — or null
 * when it was the corner check that opened it, and the book is only being
 * marked read (docs/features/marking-a-book-read.md).
 */
export interface PendingFind {
  book: LibraryBook;
  rating: number | null;
}

/** How long the input gets to settle before a keystroke becomes a search. */
const DEBOUNCE_MS = 350;

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

  // Seeded with the title minus any subtitle — ":" onwards is what most often
  // keeps the catalogue from matching.
  const [query, setQuery] = useState(book.title.replace(/:.*$/, "").trim());
  const [results, setResults] = useState<HardcoverSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [readDate, setReadDate] = useState<ReadDateChoice>({ kind: "unknown" });
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Each search remembers its turn, so a slow early answer can't overwrite a
  // fast late one.
  const searchSeq = useRef(0);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    const timer = setTimeout(() => {
      search(query)
        .then((found) => {
          if (searchSeq.current !== seq) return;
          setResults(found);
          setError(null);
        })
        .catch((err) => {
          if (searchSeq.current !== seq) return;
          setResults([]);
          setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          if (searchSeq.current === seq) setSearching(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, search]);

  async function confirm() {
    if (picked === null) return;
    setConfirming(true);
    setError(null);
    try {
      await onConfirm(picked, finishedAtOf(readDate));
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

      <div className="relative">
        <Search
          size={13}
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
        />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPicked(null);
          }}
          placeholder="Title, author…"
          autoFocus
          spellCheck={false}
          className="pl-8"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {results === null || (searching && results.length === 0) ? (
          <p className="text-muted-foreground flex items-center gap-2 py-6 text-[13px]">
            <Loader2 size={13} className="animate-spin" />
            Searching Hardcover…
          </p>
        ) : results.length === 0 ? (
          <p className="text-muted-foreground py-6 text-[13px]">
            Nothing in their catalogue for that. Try fewer words, or just the author.
          </p>
        ) : (
          <ul className="grid gap-1">
            {results.map((result) => {
              const selected = result.id === picked;
              return (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => setPicked(selected ? null : result.id)}
                    aria-pressed={selected}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition-colors",
                      selected
                        ? "border-you/50 bg-you-dim"
                        : "border-transparent hover:border-line hover:bg-fill",
                    )}
                  >
                    {/* Their CDN's cover, straight through — these books have no
                        mirrored cover yet. The placeholder keeps rows aligned. */}
                    {result.coverUrl ? (
                      <img
                        src={result.coverUrl}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="bg-fill h-15 w-10 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <span className="bg-fill text-muted-foreground flex h-15 w-10 shrink-0 items-center justify-center rounded">
                        <BookOpen size={14} />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">{result.title}</span>
                      <span className="text-muted-foreground block truncate text-[11px]">
                        {result.authors.join(", ")}
                        {result.releaseYear !== null && ` · ${result.releaseYear}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Asked only once a book is picked — before that it's noise under the
          results, and the answer belongs to a specific book. */}
      {picked !== null && (
        <ReadDatePicker
          value={readDate}
          onChange={setReadDate}
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
          <Button onClick={() => void confirm()} disabled={picked === null || confirming}>
            {confirming && <Loader2 className="animate-spin" />}
            {rating === null ? "Add as read" : `Add and rate ${rating}★`}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
