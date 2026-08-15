import { useCallback, useSyncExternalStore } from "react";
import type { LibraryBook } from "@/lib/api";

/**
 * How the shelf is held: a sort key with a direction, and an optional grouping
 * that splits the view into labelled sections. Per-device like the view mode,
 * not a stored preference. See docs/features/library-sort-and-group.md.
 */

export type SortKey = "title" | "author" | "series" | "added" | "published" | "rating";
export type SortDir = "asc" | "desc";
export type GroupKey = "none" | "author" | "series" | "readstatus";

export interface LibraryOrder {
  sort: SortKey;
  dir: SortDir;
  group: GroupKey;
}

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "author", label: "Author" },
  { key: "series", label: "Series" },
  { key: "added", label: "Date added" },
  { key: "published", label: "Published" },
  { key: "rating", label: "My rating" },
];

export const GROUP_OPTIONS: { key: GroupKey; label: string }[] = [
  { key: "none", label: "None" },
  { key: "author", label: "Author" },
  { key: "series", label: "Series" },
  { key: "readstatus", label: "Read status" },
];

/** The direction a key starts in: text reads A→Z, dates and stars newest/best first. */
const NATURAL_DIR: Record<SortKey, SortDir> = {
  title: "asc",
  author: "asc",
  series: "asc",
  added: "desc",
  published: "desc",
  rating: "desc",
};

/**
 * Choosing a key sorts it its natural way; choosing the active key again flips
 * the direction — the whole state machine of the sort menu.
 */
export function chooseSort(order: LibraryOrder, key: SortKey): LibraryOrder {
  if (order.sort === key) return { ...order, dir: order.dir === "asc" ? "desc" : "asc" };
  return { ...order, sort: key, dir: NATURAL_DIR[key] };
}

const DEFAULT_ORDER: LibraryOrder = { sort: "title", dir: "asc", group: "none" };
const STORAGE_KEY = "grimoire.order";

const SORT_KEYS = new Set(SORT_OPTIONS.map((option) => option.key));
const GROUP_KEYS = new Set(GROUP_OPTIONS.map((option) => option.key));

/** Whatever is stored, or the default — never a crash over stale JSON. */
function load(): LibraryOrder {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ORDER;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_ORDER;
    const { sort, dir, group } = parsed as Record<string, unknown>;
    if (!SORT_KEYS.has(sort as SortKey)) return DEFAULT_ORDER;
    if (dir !== "asc" && dir !== "desc") return DEFAULT_ORDER;
    if (!GROUP_KEYS.has(group as GroupKey)) return DEFAULT_ORDER;
    return { sort: sort as SortKey, dir, group: group as GroupKey };
  } catch {
    return DEFAULT_ORDER;
  }
}

// Cached so useSyncExternalStore gets the same object back between changes —
// re-parsing per read would loop the render.
let current: LibraryOrder | null = null;

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function read(): LibraryOrder {
  current ??= load();
  return current;
}

export function setLibraryOrder(order: LibraryOrder) {
  current = order;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    // Private browsing — the choice just won't survive a reload.
  }
  for (const listener of listeners) listener();
}

export function useLibraryOrder(): [LibraryOrder, (order: LibraryOrder) => void] {
  const order = useSyncExternalStore(subscribe, read, () => DEFAULT_ORDER);
  return [order, useCallback(setLibraryOrder, [])];
}

/** One labelled run of books; a null label is the whole ungrouped shelf. */
export interface BookSection {
  label: string | null;
  books: LibraryBook[];
}

/**
 * What the views need beyond the book itself: both are per-reader, so the
 * caller supplies them the same way it supplies the views' props.
 */
export interface OrderContext {
  rating?: (book: LibraryBook) => number;
  isRead?: (book: LibraryBook) => boolean;
}

/**
 * The sortable value, or null for a book that doesn't have one — a missing
 * value sorts last in *either* direction, because "no series" is not the
 * first series alphabetically.
 */
function sortValue(book: LibraryBook, key: SortKey, context: OrderContext): string | number | null {
  switch (key) {
    case "title":
      return book.title;
    case "author":
      return book.authors[0] ?? null;
    case "series":
      return book.series;
    case "added":
      return book.added;
    case "published":
      return book.published;
    case "rating": {
      const rating = context.rating?.(book) ?? 0;
      return rating > 0 ? rating : null;
    }
  }
}

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === "string" && typeof b === "string") return collator.compare(a, b);
  return Number(a) - Number(b);
}

/**
 * How a shelf reads within one owner: series alphabetically, each in reading
 * order by index, standalone books after them. Zero outside that — series
 * against series and standalone against standalone both fall to the caller's
 * next tie-break.
 */
function compareSeriesReading(a: LibraryBook, b: LibraryBook): number {
  if (a.series === null || b.series === null) {
    if (a.series !== null) return -1;
    if (b.series !== null) return 1;
    return 0;
  }
  const name = collator.compare(a.series, b.series);
  if (name !== 0) return name;
  if (a.seriesIndex === b.seriesIndex) return 0;
  if (a.seriesIndex === null) return 1;
  if (b.seriesIndex === null) return -1;
  return a.seriesIndex - b.seriesIndex;
}

/**
 * The secondary sort, once the chosen key ties. Deliberately *not* flipped
 * with the direction: authors Z→A still read each author's series #1, #2, #3.
 * Every chain ends at title, which compareBooks supplies.
 */
/** First author against first author, authorless books last. */
function compareAuthor(a: LibraryBook, b: LibraryBook): number {
  if (a.authors[0] === undefined || b.authors[0] === undefined) {
    if (a.authors[0] !== undefined) return -1;
    if (b.authors[0] !== undefined) return 1;
    return 0;
  }
  return collator.compare(a.authors[0], b.authors[0]);
}

function breakTie(a: LibraryBook, b: LibraryBook, key: SortKey): number {
  switch (key) {
    // Two books with one title: keep each author's together. A run of
    // equal ratings likewise reads as an author list, not a shuffle.
    case "title":
    case "rating":
      return compareAuthor(a, b);
    // Same author: their shelf in reading order. Same series: the index part
    // of the same comparison (the name half ties to zero and falls through).
    case "author":
    case "series":
      return compareSeriesReading(a, b);
    // Dates have nothing between a tie and the title.
    default:
      return 0;
  }
}

function compareBooks(
  a: LibraryBook,
  b: LibraryBook,
  order: LibraryOrder,
  context: OrderContext,
): number {
  const av = sortValue(a, order.sort, context);
  const bv = sortValue(b, order.sort, context);
  // Missing values last, regardless of direction.
  if (av === null || bv === null) {
    if (av !== null) return -1;
    if (bv !== null) return 1;
  } else {
    const cmp = compareValues(av, bv);
    if (cmp !== 0) return order.dir === "asc" ? cmp : -cmp;
  }
  return breakTie(a, b, order.sort) || collator.compare(a.title, b.title);
}

/** Which section a book files under, per group key. Null is the leftovers bucket. */
function groupLabel(book: LibraryBook, group: GroupKey, context: OrderContext): string | null {
  switch (group) {
    case "none":
      return null;
    case "author":
      return book.authors[0] ?? null;
    case "series":
      return book.series;
    case "readstatus":
      return context.isRead?.(book) ? "Read" : "Unread";
  }
}

/** What the leftovers bucket is called, when the group key has one. */
const LEFTOVER_LABELS: Partial<Record<GroupKey, string>> = {
  author: "Unknown author",
  series: "No series",
};

/**
 * Sort the shelf and split it into sections: sections ordered by their own
 * label (Unread before Read; leftovers last), the sort applied within each.
 * Ungrouped, the result is a single unlabelled section.
 */
export function orderLibrary(
  books: LibraryBook[],
  order: LibraryOrder,
  context: OrderContext = {},
): BookSection[] {
  const sorted = [...books].sort((a, b) => compareBooks(a, b, order, context));
  if (order.group === "none") return [{ label: null, books: sorted }];

  const sections = new Map<string | null, LibraryBook[]>();
  for (const book of sorted) {
    const label = groupLabel(book, order.group, context);
    const section = sections.get(label);
    if (section) section.push(book);
    else sections.set(label, [book]);
  }

  const labelled = [...sections.entries()].map(([label, sectionBooks]) => ({
    label: label ?? LEFTOVER_LABELS[order.group] ?? null,
    leftover: label === null,
    books: sectionBooks,
  }));
  labelled.sort((a, b) => {
    if (a.leftover !== b.leftover) return a.leftover ? 1 : -1;
    if (order.group === "readstatus") return a.label === "Unread" ? -1 : 1;
    return collator.compare(a.label ?? "", b.label ?? "");
  });
  return labelled.map(({ label, books: sectionBooks }) => ({ label, books: sectionBooks }));
}
