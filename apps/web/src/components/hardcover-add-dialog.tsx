import { BookMarked, Bookmark, BookOpen, Loader2 } from "lucide-react";
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
import type { HardcoverAdd, HardcoverSearchResult } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * The shelves worth *adding to* — Hardcover's other three (Paused, Did not
 * finish, Ignored) all describe a book you already have. Read leads, because
 * recording something already finished is what reaching for this usually means.
 */
const SHELVES = [
  { statusId: 3, label: "Read", icon: BookMarked, verb: "Add as read" },
  { statusId: 1, label: "Want to read", icon: Bookmark, verb: "Add to want to read" },
  { statusId: 2, label: "Reading", icon: BookOpen, verb: "Add as reading" },
] as const;

/** Whatever the route accepts — the chips are the same three, by construction. */
type ShelfStatusId = HardcoverAdd["statusId"];

/**
 * Adding a book Grimoire has no side of at all
 * (docs/features/adding-a-book-from-hardcover.md): search Hardcover's
 * catalogue, pick the book, choose which shelf it lands on, and — for a book
 * they've read — when they finished it. Shelving it there is what puts it in
 * the library, so the dialog says so.
 */
export function HardcoverAddDialog({
  open,
  onOpenChange,
  readerName,
  search,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whose shelves the pick lands on. */
  readerName?: string;
  /** Run one catalogue search — the API route, injected so stories can stub it. */
  search: (query: string) => Promise<HardcoverSearchResult[]>;
  /**
   * Shelve the picked book. Resolves when it lands; rejects with something
   * worth showing — the dialog stays open until it settles.
   */
  onAdd: (add: HardcoverAdd) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Radix only mounts this while open, so every visit starts on an empty
          search rather than the last one's results. */}
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-lg">
        {open && (
          <AddBody
            readerName={readerName}
            search={search}
            onAdd={onAdd}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddBody({
  readerName,
  search,
  onAdd,
  onCancel,
}: {
  readerName?: string;
  search: (query: string) => Promise<HardcoverSearchResult[]>;
  onAdd: (add: HardcoverAdd) => Promise<void>;
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState<HardcoverSearchResult | null>(null);
  const [statusId, setStatusId] = useState<ShelfStatusId>(3);
  const [readDate, setReadDate] = useState<ReadDateChoice>({ kind: "unknown" });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shelf = SHELVES.find((option) => option.statusId === statusId) ?? SHELVES[0];
  const whose = readerName ? `${readerName}'s` : "your";

  async function add() {
    if (!picked) return;
    setAdding(true);
    setError(null);
    try {
      await onAdd({
        hardcoverBookId: picked.id,
        statusId,
        // Only a finished book has a finish date; the picker isn't even shown
        // for the other shelves.
        finishedAt: statusId === 3 ? finishedAtOf(readDate) : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setAdding(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add a book from Hardcover</DialogTitle>
        <DialogDescription>
          Find it in Hardcover's catalogue. It goes on {whose} shelves there, and joins the library
          here.
        </DialogDescription>
      </DialogHeader>

      <HardcoverBookSearch search={search} picked={picked?.id ?? null} onPick={setPicked} />

      {/* Asked only once a book is picked — before that both questions are
          noise under the results. */}
      {picked && (
        <div className="border-line grid gap-3 border-t pt-3">
          <fieldset className="grid gap-2">
            <legend className="text-muted-foreground text-[11px] tracking-wide uppercase">
              Which shelf?
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {SHELVES.map(({ statusId: id, label, icon: Icon }) => {
                const active = id === statusId;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setStatusId(id)}
                    aria-pressed={active}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors",
                      active
                        ? "border-you/50 bg-you-dim text-foreground"
                        : "border-line text-muted-foreground hover:border-line-strong hover:text-foreground",
                    )}
                  >
                    <Icon size={13} />
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {statusId === 3 && (
            <ReadDatePicker
              value={readDate}
              onChange={setReadDate}
              // The picked edition is the one being shelved, so its release
              // year bounds the answer.
              publishedYear={picked.releaseYear}
            />
          )}
        </div>
      )}

      {error && <p className="text-destructive text-[12px]">{error}</p>}

      <DialogFooter className="items-center gap-3 sm:justify-between">
        <p className="text-muted-foreground text-[11px]">
          Adding puts it on {whose} Hardcover shelves as{" "}
          <span className="text-foreground">{shelf.label}</span>.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={adding}>
            Cancel
          </Button>
          <Button onClick={() => void add()} disabled={!picked || adding}>
            {adding && <Loader2 className="animate-spin" />}
            {shelf.verb}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
