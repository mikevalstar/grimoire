import { BookOpen, Loader2, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import type { HardcoverSearchResult } from "@/lib/api";
import { cn } from "@/lib/utils";

/** How long the input gets to settle before a keystroke becomes a search. */
const DEBOUNCE_MS = 350;

/**
 * Searching Hardcover's catalogue and picking one book out of it — the shared
 * half of the two dialogs that do it: the
 * [finder](docs/features/rating-a-book.md), which starts from a book Grimoire
 * already has, and the
 * [add](docs/features/adding-a-book-from-hardcover.md), which starts from
 * nothing. Owns the debounce, the out-of-order guard and its own search
 * failures; the pick, and what to do with it, belong to the caller.
 */
export function HardcoverBookSearch({
  search,
  initialQuery = "",
  picked,
  onPick,
  className,
}: {
  /** Run one catalogue search — the API route, injected so stories can stub it. */
  search: (query: string) => Promise<HardcoverSearchResult[]>;
  /** What to search for on mount. Empty waits for the reader to type. */
  initialQuery?: string;
  /** The picked book's Hardcover id, held by the caller so it can be cleared. */
  picked: number | null;
  /** The pick, or null when it was clicked off. */
  onPick: (result: HardcoverSearchResult | null) => void;
  className?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  // Null until the first search settles — which is "searching" for a seeded
  // query and "nothing asked yet" for an empty one.
  const [results, setResults] = useState<HardcoverSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
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

  const typing = query.trim().length > 0;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3", className)}>
      <div className="relative">
        <Search
          size={13}
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
        />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onPick(null);
          }}
          placeholder="Title, author…"
          autoFocus
          spellCheck={false}
          className="pl-8"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <p className="text-destructive py-6 text-[13px]">{error}</p>
        ) : !typing ? (
          <p className="text-muted-foreground py-6 text-[13px]">
            Type a title or an author to search Hardcover.
          </p>
        ) : results === null || (searching && results.length === 0) ? (
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
                    onClick={() => onPick(selected ? null : result)}
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
    </div>
  );
}
