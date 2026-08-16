import { z } from "zod";
import type { ReadStatusFilterValue } from "@/components/read-status-filter";
import {
  GROUP_OPTIONS,
  type GroupKey,
  type LibraryOrder,
  SORT_OPTIONS,
  type SortDir,
  type SortKey,
} from "@/lib/library-order";

/**
 * How the shelf is narrowed and ordered, as one object — and as URL search
 * parameters, so any view of the library is a link
 * (ADR 0020, docs/features/book-list.md).
 *
 * The view *mode* (covers or list) is deliberately not here: it is how this
 * device draws whatever it is given, not a view of the library.
 */
export interface LibraryView extends LibraryOrder {
  /** The filter box, terms and all — see book-filter.ts. */
  q: string;
  /** Selected sources; empty is *all* (docs/features/library-source-filter.md). */
  sources: string[];
  read: ReadStatusFilterValue;
}

/** What a bare `/` means, before this device's stored order is layered under it. */
export const LIBRARY_VIEW_DEFAULTS: LibraryView = {
  q: "",
  sources: [],
  read: "all",
  sort: "title",
  dir: "asc",
  group: "none",
};

const sortKeys = SORT_OPTIONS.map((option) => option.key) as [SortKey, ...SortKey[]];
const groupKeys = GROUP_OPTIONS.map((option) => option.key) as [GroupKey, ...GroupKey[]];

/**
 * The route's search parameters. Every field is optional and every field
 * catches: a hand-edited or outdated link degrades to the default rather than
 * erroring the route, and unknown parameters are dropped.
 *
 * Sources are comma-joined rather than JSON-encoded, so the URL stays readable
 * and stays a thing somebody can edit by hand.
 */
export const librarySearchSchema = z.object({
  q: z.string().catch("").optional(),
  sources: z.string().catch("").optional(),
  read: z.enum(["all", "to-read", "read"]).catch("all").optional(),
  sort: z.enum(sortKeys).catch("title").optional(),
  dir: z
    .enum(["asc", "desc"] as const)
    .catch("asc")
    .optional(),
  group: z.enum(groupKeys).catch("none").optional(),
});

export type LibrarySearch = z.infer<typeof librarySearchSchema>;

/**
 * The view a URL describes, with this device's stored order under any of
 * sort/dir/group the URL doesn't name — an explicit parameter always wins, so
 * a link is never reinterpreted by the recipient's stored preference.
 */
export function libraryViewFromSearch(search: LibrarySearch, stored: LibraryOrder): LibraryView {
  return {
    q: search.q ?? LIBRARY_VIEW_DEFAULTS.q,
    sources: search.sources ? search.sources.split(",").filter(Boolean) : [],
    read: search.read ?? LIBRARY_VIEW_DEFAULTS.read,
    sort: search.sort ?? stored.sort,
    dir: search.dir ?? stored.dir,
    group: search.group ?? stored.group,
  };
}

/**
 * The parameters a view needs. Filters at their default drop out, so a plain
 * shelf is a plain `/`.
 *
 * The order is written as a set — all three or none — because it defaults from
 * `localStorage` rather than from a constant: dropping `sort=title` would hand
 * the next read back to a stored `sort=added`, which is not what the reader
 * just asked for. `orderTouched` is false until some control moves it.
 */
export function libraryViewToSearch(view: LibraryView, orderTouched: boolean): LibrarySearch {
  return {
    q: view.q || undefined,
    sources: view.sources.length > 0 ? view.sources.join(",") : undefined,
    read: view.read === "all" ? undefined : view.read,
    sort: orderTouched ? view.sort : undefined,
    dir: orderTouched ? view.dir : undefined,
    group: orderTouched ? view.group : undefined,
  };
}

/** Whether a change touches the order rather than the filters. */
export function touchesOrder(patch: Partial<LibraryView>): boolean {
  return patch.sort !== undefined || patch.dir !== undefined || patch.group !== undefined;
}

/** How a view changes: a patch, and whether it deserves its own history entry. */
export interface LibraryViewChange {
  patch: Partial<LibraryView>;
  /**
   * Push rather than replace. Clicking an author or a sort option is a
   * navigation to undo; typing in the filter box is not — one history entry
   * per keystroke would break the back button.
   */
  push?: boolean;
}

export type SetLibraryView = (change: LibraryViewChange) => void;

export type { GroupKey, LibraryOrder, SortDir, SortKey };
