import {
  ApiErrorSchema,
  type Book,
  BookSchema,
  BooksSchema,
  type CalibreServerTest,
  CalibreServerTestSchema,
  type CoverRefetch,
  CoverRefetchSchema,
  type DuplicateCandidate,
  type DuplicateReason,
  type Duplicates,
  DuplicatesSchema,
  type HardcoverAdd,
  HardcoverAddResultSchema,
  type HardcoverContent,
  type HardcoverContentPrefs,
  HardcoverContentSchema,
  type HardcoverRatings,
  HardcoverRatingsSchema,
  type HardcoverSearchResult,
  HardcoverSearchResultsSchema,
  type HardcoverTest,
  HardcoverTestSchema,
  hardcoverContentPrefs,
  type MatchOutcome,
  MatchOutcomeSchema,
  type PendingDuplicate,
  type PendingDuplicates,
  PendingDuplicatesSchema,
  type Preferences,
  PreferencesSchema,
  type RatingResult,
  RatingResultSchema,
  type RatingSource,
  type Ratings,
  RatingsSchema,
  type ReadDates,
  ReadDatesSchema,
  type ReadStateResult,
  ReadStateResultSchema,
  type ReadStates,
  ReadStatesSchema,
  type SeriesApply,
  SeriesApplyResultSchema,
  type SeriesOption,
  type SeriesOptions,
  SeriesOptionsSchema,
  type SeriesRef,
  type SeriesRoster,
  type SeriesRosterEntry,
  SeriesRosterSchema,
  type SyncStatus,
  SyncStatusSchema,
  type User,
  type UserCreate,
  UserSchema,
  type UserSettings,
  UsersSchema,
  type WorkMember,
} from "@grimoire/core/schemas";
import {
  BOOK_SOURCE,
  COVER_SIZES,
  type CoverSize,
  DEFAULT_SYNC_INTERVAL_MINUTES,
  hardcoverStatusLabel,
  PREF_KEYS,
  PREFERENCES_VERSION,
  SYNC_INTERVAL_CHOICES,
  USER_HEADER,
} from "@grimoire/core/types";
import type { z } from "zod";

export type {
  Book,
  CalibreServerTest,
  CoverSize,
  DuplicateCandidate,
  DuplicateReason,
  Duplicates,
  HardcoverAdd,
  HardcoverContent,
  HardcoverContentPrefs,
  HardcoverRatings,
  HardcoverSearchResult,
  HardcoverTest,
  MatchOutcome,
  PendingDuplicate,
  PendingDuplicates,
  Preferences,
  RatingResult,
  RatingSource,
  Ratings,
  ReadDates,
  ReadStateResult,
  ReadStates,
  SeriesApply,
  SeriesOption,
  SeriesOptions,
  SeriesRef,
  SeriesRoster,
  SeriesRosterEntry,
  SyncStatus,
  User,
  UserCreate,
  UserSettings,
  WorkMember,
};
export {
  BOOK_SOURCE,
  COVER_SIZES,
  DEFAULT_SYNC_INTERVAL_MINUTES,
  hardcoverContentPrefs,
  hardcoverStatusLabel,
  PREF_KEYS,
  PREFERENCES_VERSION,
  SYNC_INTERVAL_CHOICES,
};

/**
 * Where the API lives depends on how the UI is being served:
 * - Vite dev server / hosted server: same origin ("" — /api is proxied or local)
 * - Electrobun desktop (views:// origin): the embedded server on localhost,
 *   whose port is passed via the ?apiPort query param (default 4747).
 */
function resolveApiBase(): string {
  if (window.location.protocol === "views:") {
    const port = new URLSearchParams(window.location.search).get("apiPort") ?? "4747";
    return `http://localhost:${port}`;
  }
  return "";
}

export const API_BASE = resolveApiBase();

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** A response that didn't match its schema — the server and this build disagree. */
export class ApiShapeError extends Error {
  constructor(
    readonly path: string,
    readonly cause: z.ZodError,
  ) {
    super(`${path} returned an unexpected shape: ${cause.issues[0]?.message ?? "parse failed"}`);
    this.name = "ApiShapeError";
  }
}

/**
 * Fetch, then parse against the shared schema (ADR 0009) so drift surfaces
 * here with a field path rather than as an undefined three components deep.
 */
async function request<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: { method: string; body?: unknown; userId?: number },
): Promise<z.infer<S>> {
  const headers: Record<string, string> = {};
  if (init?.body !== undefined) headers["Content-Type"] = "application/json";
  // Who this request is for (ADR 0008). Only user-scoped routes look at it.
  if (init?.userId !== undefined) headers[USER_HEADER] = String(init.userId);

  const res = await fetch(`${API_BASE}${path}`, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError(res.status, res.statusText || "The server sent a non-JSON response");
  }

  if (!res.ok) {
    const err = ApiErrorSchema.safeParse(body);
    throw new ApiError(res.status, err.success ? err.data.error : res.statusText, err.data?.hint);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiShapeError(path, parsed.error);
  return parsed.data;
}

export function fetchPreferences() {
  return request("/api/preferences", PreferencesSchema);
}

/** Merge-update: only the given keys change. Returns the full new set. */
export function savePreferences(preferences: Preferences) {
  return request("/api/preferences", PreferencesSchema, { method: "PUT", body: preferences });
}

export function fetchUsers() {
  return request("/api/users", UsersSchema);
}

/** Create a reader. Omit the colour to be given the first unused one. */
export function createUser(user: UserCreate) {
  return request("/api/users", UserSchema, { method: "POST", body: user });
}

/**
 * A reader's link to hardcover.app (ADR 0012). The token goes *up* and never
 * comes back: nothing the API returns to this client carries it, so `User`
 * knows only which account a reader is linked to.
 * See docs/features/hardcover-connection.md.
 */

/** Probe a token without saving it. Omit it to re-probe the stored one. */
export function testHardcover(userId: number, token?: string) {
  return request(`/api/users/${userId}/hardcover/test`, HardcoverTestSchema, {
    method: "POST",
    body: { token },
  });
}

/** Link a reader to a Hardcover account. Rejects a token Hardcover won't accept. */
export function linkHardcover(userId: number, token: string) {
  return request(`/api/users/${userId}/hardcover`, UserSchema, {
    method: "PUT",
    body: { token },
  });
}

/** Forget the token, and the shelf entries synced under it. */
export function unlinkHardcover(userId: number) {
  return request(`/api/users/${userId}/hardcover`, UserSchema, { method: "DELETE" });
}

/**
 * Pull this reader's Hardcover shelves now. Runs to completion server-side, so
 * this resolves when the sweep is done — with the reader's updated counts, or
 * with `hardcoverSyncError` set if it failed (docs/features/hardcover-sync.md).
 */
export function syncHardcover(userId: number) {
  return request(`/api/users/${userId}/hardcover/sync`, UserSchema, { method: "POST" });
}

/** Every local rating this reader has set, keyed by work id. */
export function fetchRatings(userId: number) {
  return request("/api/ratings", RatingsSchema, { method: "GET", userId });
}

/**
 * The same map from their Hardcover mirror — an entry per shelved book, null
 * where the shelf entry is unrated, so presence doubles as "on their shelves"
 * (ADR 0014).
 */
export function fetchHardcoverRatings(userId: number) {
  return request("/api/ratings/hardcover", HardcoverRatingsSchema, { method: "GET", userId });
}

/** One book's full reading history, requested live from Hardcover. */
export function fetchHardcoverReadDates(userId: number, bookId: number) {
  return request(`/api/books/${bookId}/read-dates/hardcover`, ReadDatesSchema, {
    method: "GET",
    userId,
  });
}

/**
 * What Hardcover has written about one book — description, tags and moods —
 * requested live for an open panel and never stored
 * (docs/features/book-details-panel.md).
 */
export function fetchHardcoverContent(userId: number, bookId: number) {
  return request(`/api/books/${bookId}/hardcover`, HardcoverContentSchema, {
    method: "GET",
    userId,
  });
}

/**
 * The series Hardcover has for one book, with what Grimoire already knows about
 * each (docs/features/setting-a-series-from-hardcover.md). `hardcoverBookId`
 * names the catalogue book explicitly, for a Calibre-only book whose match the
 * reader picked out of the finder.
 */
export function fetchHardcoverSeries(userId: number, bookId: number, hardcoverBookId?: number) {
  const query = hardcoverBookId ? `?hardcoverBookId=${hardcoverBookId}` : "";
  return request(`/api/books/${bookId}/hardcover/series${query}`, SeriesOptionsSchema, {
    method: "GET",
    userId,
  });
}

/** Every book in a series, matched against the shelf server-side. */
export function fetchSeriesRoster(userId: number, hardcoverId: number) {
  return request(`/api/hardcover/series/${hardcoverId}/roster`, SeriesRosterSchema, {
    method: "GET",
    userId,
  });
}

/** Put a series on every work the reader agreed to. */
export function applySeries(userId: number, body: SeriesApply) {
  return request("/api/series/apply", SeriesApplyResultSchema, {
    method: "POST",
    body,
    userId,
  });
}

/**
 * Search Hardcover's catalogue as this reader — the finder behind rating a
 * Calibre-only book in Hardcover mode (docs/features/rating-a-book.md).
 */
export function searchHardcover(userId: number, query: string) {
  return request(`/api/users/${userId}/hardcover/search`, HardcoverSearchResultsSchema, {
    method: "POST",
    body: { query },
  });
}

/**
 * Add a book Grimoire has no side of at all: shelve the reader's catalogue pick
 * on Hardcover, which is what puts it in the library
 * (docs/features/adding-a-book-from-hardcover.md). Answers the new work's id,
 * or null when it will only arrive on the next sweep.
 */
export function addHardcoverBook(userId: number, add: HardcoverAdd) {
  return request(`/api/users/${userId}/hardcover/books`, HardcoverAddResultSchema, {
    method: "POST",
    body: add,
  });
}

/**
 * Set this reader's rating for a book; 0 clears it. Where it lands follows
 * their rating source (ADR 0014) — `hardcover` writes to their hardcover.app
 * account, `addToShelf` relays their confirmation that rating an unshelved
 * book may add it to their shelves as Read, and `hardcoverBookId` names the
 * finder's pick for a work with no Hardcover edition yet.
 */
export function saveRating(
  userId: number,
  bookId: number,
  rating: number,
  options?: {
    source?: RatingSource;
    addToShelf?: boolean;
    hardcoverBookId?: number;
    /** Confirmation that a shelved-but-unfinished book may flip to Read. */
    markRead?: boolean;
    /** When they finished it, at its own precision — see RatingUpdateSchema. */
    finishedAt?: string;
  },
) {
  return request(`/api/ratings/${bookId}`, RatingResultSchema, {
    method: "PUT",
    body: { rating, ...options },
    userId,
  });
}

/** Which per-reader settings to change — the rating and read-state sources. */
export function updateUserSettings(userId: number, settings: UserSettings) {
  return request(`/api/users/${userId}`, UserSchema, { method: "PATCH", body: settings });
}

/** The reader's *local* read states (docs/features/marking-a-book-read.md). */
export function fetchReadStates(userId: number) {
  return request("/api/read-states", ReadStatesSchema, { method: "GET", userId });
}

/**
 * Mark a book read or unread, through whichever source the reader chose. The
 * optional rating (marking) and removeRating (unmarking) land in the same
 * source; the Hardcover fields mean what they do on the ratings route.
 */
export function saveReadState(
  userId: number,
  bookId: number,
  update: {
    read: boolean;
    finishedAt?: string;
    rating?: number;
    removeRating?: boolean;
    source?: RatingSource;
    addToShelf?: boolean;
    hardcoverBookId?: number;
  },
) {
  return request(`/api/read-states/${bookId}`, ReadStateResultSchema, {
    method: "PUT",
    body: update,
    userId,
  });
}

/**
 * Whether the shelf should wear the corner check for this book: their
 * Hardcover status when the reader's read state lives there, the local map
 * otherwise (docs/features/marking-a-book-read.md).
 */
export function bookIsRead(
  book: LibraryBook,
  source: RatingSource,
  readStates: ReadStates | undefined,
  hardcoverRatings: HardcoverRatings | undefined,
): boolean {
  if (source === "hardcover") return hardcoverRatings?.[String(book.id)]?.statusId === 3;
  return String(book.id) in (readStates ?? {});
}

/**
 * The rating to show — the reader's own, from whichever source they chose
 * (ADR 0014); a Hardcover map holds null for shelved-but-unrated books, which
 * reads as unrated. Calibre's rating is deliberately not a fallback: stars in
 * the user accent mean *your* verdict, and borrowing Calibre's would make an
 * unrated book look rated by you (docs/features/rating-a-book.md).
 */
export function bookRating(
  book: LibraryBook,
  ratings: Ratings | HardcoverRatings | undefined,
): number {
  const value = ratings?.[String(book.id)];
  if (value == null) return 0;
  // A local map holds bare numbers; the Hardcover map wraps the rating with
  // the shelf status (null = shelved but unrated).
  return typeof value === "number" ? value : (value.rating ?? 0);
}

/** Ask the API to probe a candidate Calibre content server URL. */
export function testCalibreServer(url: string) {
  return request("/api/calibre/test", CalibreServerTestSchema, {
    method: "POST",
    body: { url },
  });
}

/** True when first-time setup hasn't been completed for this app version. */
export function needsSetup(preferences: Preferences): boolean {
  return Number(preferences[PREF_KEYS.version] ?? 0) < PREFERENCES_VERSION;
}

/**
 * A book as the library screens use it — Grimoire's own record, served from
 * grimoire.db rather than assembled from Calibre per page load (ADR 0011). The
 * shape is `BookSchema`; this alias is what the components spell.
 *
 * See docs/features/book-list.md and docs/features/calibre-sync.md.
 */
export type LibraryBook = Book;

/**
 * A cached cover, by Grimoire book id. Sync fetched these at fixed sizes, so
 * callers pick the nearest name rather than asking for arbitrary pixels —
 * there is no scaler on this path any more, just a file.
 *
 * `member` names one of the work's covers rather than taking its chosen one.
 * Passing the chosen member is what makes the URL change when a reader swaps
 * covers — the file is served with a year-long max-age, so an unchanged URL
 * would go on showing the old cover (docs/features/book-details-panel.md).
 *
 * `version` is the same trick for the file changing under a fixed member:
 * re-fetching a cover rewrites it in place (docs/features/book-actions.md).
 */
export function bookCoverUrl(
  id: number,
  size: CoverSize,
  member?: number | null,
  version?: string | null,
): string {
  const query = new URLSearchParams();
  if (member != null) query.set("member", String(member));
  if (version) query.set("v", version);
  const search = query.toString();
  return `${API_BASE}/api/books/${id}/cover/${size}${search ? `?${search}` : ""}`;
}

/** The cached size to ask for when a cover will be drawn about `width` CSS px wide. */
export function coverSizeFor(width: number): CoverSize {
  if (width <= 60) return "thumb";
  if (width <= 260) return "card";
  return "full";
}

/**
 * The book's file itself, through the proxy — the one thing still fetched from
 * Calibre on demand. Calibre answers with the right MIME type and a
 * Content-Disposition filename, so nothing here has to name the download.
 *
 * Takes a *Calibre* id, which is why it is null for a book that has left the
 * library: there is no file to point at any more.
 */
export function bookDownloadUrl(calibreId: number, format: string): string {
  return `${API_BASE}/api/cs/get/${format.toLowerCase()}/${calibreId}`;
}

/**
 * Whether the book is still in the connected Calibre library — the test for
 * whether there is a file to download.
 *
 * Not the test for the "no longer in Calibre" mark: a book from another source
 * has no Calibre id and never had one, so this would accuse Calibre of losing a
 * book it never held. That mark is per source, in `bookMarks`.
 */
export function isInLibrary(book: Pick<LibraryBook, "calibreId">): boolean {
  return book.calibreId !== null;
}

/**
 * The image to draw for a book: Grimoire's own cached file when sync fetched
 * one, otherwise the source's own URL. Hardcover serves covers from a CDN and
 * gives us no scaler, so those load over the network rather than from disk.
 */
export function bookImageUrl(
  book: Pick<LibraryBook, "id" | "coverState"> &
    Partial<Pick<LibraryBook, "coverUrl" | "coverBookId" | "coverVersion">>,
  width: number,
): string {
  if (book.coverState !== "cached" && book.coverUrl) return book.coverUrl;
  return bookCoverUrl(book.id, coverSizeFor(width), book.coverBookId, book.coverVersion);
}

/** Most portable first — the order a book's formats are offered in. */
const FORMAT_PREFERENCE = ["EPUB", "AZW3", "MOBI", "PDF"];

/**
 * The book's formats, most portable first, with anything unranked after them in
 * alphabetical order — the order the download picker lists them in, and, for a
 * book with a single format, the one thing it hands over.
 */
export function orderedFormats(formats: string[]): string[] {
  const rank = (format: string) => {
    const index = FORMAT_PREFERENCE.indexOf(format.toUpperCase());
    return index === -1 ? FORMAT_PREFERENCE.length : index;
  };
  return [...formats].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/**
 * The library, in one call, from Grimoire's own database — so it renders with
 * the Calibre content server stopped, and sorting it is ours to decide rather
 * than Calibre's (ADR 0011). The server sorts by title.
 */
export function fetchBooks(): Promise<LibraryBook[]> {
  return request("/api/books", BooksSchema);
}

/**
 * Show this member's cover for the work from now on, for every reader — a
 * cover is what a book looks like, not an opinion about it. Answers with the
 * book as it now is (docs/features/book-details-panel.md).
 */
export function chooseBookCover(workId: number, bookId: number): Promise<LibraryBook> {
  return request(`/api/books/${workId}/cover`, BookSchema, {
    method: "PUT",
    body: { bookId },
  });
}

/**
 * Fetch this book's covers again from every source it has and overwrite what is
 * cached (docs/features/book-actions.md). Answers with the book — whose
 * `coverVersion` has moved, which is what makes the new image visible — and
 * with how the run went, so a fetch that found nothing can say so.
 */
export function refetchBookCover(workId: number): Promise<CoverRefetch> {
  return request(`/api/books/${workId}/cover/refetch`, CoverRefetchSchema, { method: "POST" });
}

/**
 * The entries this work is made of, and the ones that look like they belong in
 * it (docs/features/resolving-duplicates.md).
 *
 * A candidate names another work and nothing else — its metadata is already in
 * hand from `fetchBooks`, and looking it up there keeps the panel and the shelf
 * showing the same book.
 */
export function fetchDuplicates(workId: number): Promise<Duplicates> {
  return request(`/api/books/${workId}/duplicates`, DuplicatesSchema);
}

/**
 * The library-wide review queue: every pair the matcher refused and nobody has
 * answered (docs/features/resolving-duplicates.md). Pairs name works; their
 * metadata comes from `fetchBooks`, same as the panel's candidates.
 */
export function fetchPendingDuplicates(): Promise<PendingDuplicates> {
  return request("/api/duplicates", PendingDuplicatesSchema);
}

/**
 * These two works are the same book: one work from now on, pinned so a later
 * sync doesn't undo it. Answers with the work that survived — the older of the
 * two, so not necessarily the one asked about.
 */
export function linkDuplicate(workId: number, otherWorkId: number): Promise<LibraryBook> {
  return request(`/api/books/${workId}/duplicates`, BookSchema, {
    method: "POST",
    body: { workId: otherWorkId },
  });
}

/** Not the same book. Remembered, so neither the panel nor the matcher asks again. */
export function dismissDuplicate(
  workId: number,
  bookId: number,
  otherBookId: number,
): Promise<Duplicates> {
  return request(`/api/books/${workId}/duplicates/dismiss`, DuplicatesSchema, {
    method: "POST",
    body: { bookId, otherBookId },
  });
}

/** Move one entry back out into a book of its own — the undo for a merge. */
export function separateMember(workId: number, bookId: number): Promise<LibraryBook> {
  return request(`/api/books/${workId}/separate`, BookSchema, {
    method: "POST",
    body: { bookId },
  });
}

/** Where the sync is up to, and what went wrong last time if anything did. */
export function fetchSyncStatus(): Promise<SyncStatus> {
  return request("/api/sync", SyncStatusSchema);
}

/** Kick off a full sync. Returns immediately; watch `fetchSyncStatus` for progress. */
export function startSync(): Promise<SyncStatus> {
  return request("/api/sync", SyncStatusSchema, { method: "POST" });
}

/**
 * Look for duplicates across sources now. This also runs at startup and after
 * any sync that changed something, so it is a "do it again" rather than the
 * only way it ever happens (docs/features/book-matching.md).
 */
export function matchBooks(): Promise<MatchOutcome> {
  return request("/api/match", MatchOutcomeSchema, { method: "POST" });
}

/** How often to sync automatically. 0 means never. */
export function saveSyncInterval(intervalMinutes: number): Promise<SyncStatus> {
  return request("/api/sync/settings", SyncStatusSchema, {
    method: "PUT",
    body: { intervalMinutes },
  });
}
