import {
  ApiErrorSchema,
  type Book,
  BookSchema,
  BooksSchema,
  type CalibreServerTest,
  CalibreServerTestSchema,
  type HardcoverTest,
  HardcoverTestSchema,
  type MatchOutcome,
  MatchOutcomeSchema,
  type Preferences,
  PreferencesSchema,
  type RatingResult,
  RatingResultSchema,
  type Ratings,
  RatingsSchema,
  type SyncStatus,
  SyncStatusSchema,
  type User,
  type UserCreate,
  UserSchema,
  UsersSchema,
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
  HardcoverTest,
  MatchOutcome,
  Preferences,
  RatingResult,
  Ratings,
  SyncStatus,
  User,
  UserCreate,
};
export {
  BOOK_SOURCE,
  COVER_SIZES,
  DEFAULT_SYNC_INTERVAL_MINUTES,
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

/** Every rating this reader has set, keyed by Calibre book id. */
export function fetchRatings(userId: number) {
  return request("/api/ratings", RatingsSchema, { method: "GET", userId });
}

/** Set this reader's rating for a book. 0 clears it. */
export function saveRating(userId: number, bookId: number, rating: number) {
  return request(`/api/ratings/${bookId}`, RatingResultSchema, {
    method: "PUT",
    body: { rating },
    userId,
  });
}

/**
 * The rating to show — the reader's own, and only ever theirs. Calibre's
 * rating is deliberately not a fallback: stars in the user accent mean *your*
 * verdict, and borrowing Calibre's would make an unrated book look rated by
 * you (docs/features/rating-a-book.md).
 */
export function bookRating(book: LibraryBook, ratings: Ratings | undefined): number {
  return ratings?.[String(book.id)] ?? 0;
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
 */
export function bookCoverUrl(id: number, size: CoverSize, member?: number | null): string {
  const url = `${API_BASE}/api/books/${id}/cover/${size}`;
  return member == null ? url : `${url}?member=${member}`;
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
    Partial<Pick<LibraryBook, "coverUrl" | "coverBookId">>,
  width: number,
): string {
  if (book.coverState !== "cached" && book.coverUrl) return book.coverUrl;
  return bookCoverUrl(book.id, coverSizeFor(width), book.coverBookId);
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
