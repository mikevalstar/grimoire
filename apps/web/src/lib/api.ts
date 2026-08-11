import {
  ApiErrorSchema,
  type CalibreServerTest,
  CalibreServerTestSchema,
  CsBooksSchema,
  CsSearchSchema,
  type Preferences,
  PreferencesSchema,
  type RatingResult,
  RatingResultSchema,
  type Ratings,
  RatingsSchema,
  type User,
  type UserCreate,
  UserSchema,
  UsersSchema,
} from "@grimoire/core/schemas";
import { PREF_KEYS, PREFERENCES_VERSION, USER_HEADER } from "@grimoire/core/types";
import type { z } from "zod";

export type { CalibreServerTest, Preferences, RatingResult, Ratings, User, UserCreate };
export { PREF_KEYS, PREFERENCES_VERSION };

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
 * A book as the library screens use it: Calibre's snake_case metadata narrowed
 * to the fields we render, with its nulls resolved once here rather than in
 * every view. See docs/features/book-list.md.
 */
export interface LibraryBook {
  id: number;
  title: string;
  authors: string[];
  series: string | null;
  /** Position within `series`, null when the book is standalone. */
  seriesIndex: number | null;
  // No rating here on purpose: a book's stars are per-reader and come from
  // /api/ratings, never from Calibre. See docs/features/rating-a-book.md.
  tags: string[];
  /** Uppercased, e.g. ["EPUB", "PDF"]. */
  formats: string[];
  /** When Calibre took the book in — ISO 8601, or null. */
  added: string | null;
  /** Publication date — ISO 8601, or null. */
  published: string | null;
}

/**
 * A cover thumbnail, through the proxy so the browser never talks to Calibre
 * directly. Calibre does the scaling, so ask for roughly the size you'll draw.
 */
export function bookCoverUrl(id: number, width: number, height: number): string {
  return `${API_BASE}/api/cs/get/thumb/${id}?sz=${width}x${height}`;
}

/**
 * The book's file itself, also through the proxy. Calibre answers with the
 * right MIME type and a Content-Disposition filename, so nothing here has to
 * name the download.
 */
export function bookDownloadUrl(id: number, format: string): string {
  return `${API_BASE}/api/cs/get/${format.toLowerCase()}/${id}`;
}

/** Most portable first — what to hand over when the reader didn't pick a format. */
const FORMAT_PREFERENCE = ["EPUB", "AZW3", "MOBI", "PDF"];

/** The one format to offer on a shelf. Null when Calibre has no file for the book. */
export function preferredFormat(formats: string[]): string | null {
  for (const candidate of FORMAT_PREFERENCE) {
    if (formats.includes(candidate)) return candidate;
  }
  return formats[0] ?? null;
}

/**
 * The book list, from the Calibre content server through our proxy: one call
 * for the ids in sort order, a second for their metadata.
 */
export async function fetchBooks(): Promise<LibraryBook[]> {
  const search = await request("/api/cs/ajax/search?num=9999&sort=title", CsSearchSchema);
  if (search.book_ids.length === 0) return [];

  const meta = await request(`/api/cs/ajax/books?ids=${search.book_ids.join(",")}`, CsBooksSchema);

  // Keep the content server's sort order; ids it didn't recognise come back null.
  return search.book_ids.map((id) => {
    const book = meta[String(id)];
    return {
      id,
      title: book?.title ?? `(book ${id})`,
      authors: book?.authors ?? [],
      series: book?.series ?? null,
      seriesIndex: book?.series_index ?? null,
      tags: book?.tags ?? [],
      formats: (book?.formats ?? []).map((format) => format.toUpperCase()),
      added: book?.timestamp ?? null,
      published: book?.pubdate ?? null,
    };
  });
}
