import { PREF_KEYS, PREFERENCES_VERSION } from "@grimoire/core/types";
import type {
  Book,
  BookList,
  CalibreServerTest,
  LibraryInfo,
  Preferences,
} from "@grimoire/core/types";

export type { Book, BookList, CalibreServerTest, LibraryInfo, Preferences };
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

async function request<T>(
  path: string,
  init?: { method: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new ApiError(res.status, body.error ?? res.statusText, body.hint);
  }
  return body as T;
}

export function fetchBooks(params: { search?: string; limit?: number; offset?: number } = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.offset !== undefined) query.set("offset", String(params.offset));
  const qs = query.toString();
  return request<BookList>(`/api/books${qs ? `?${qs}` : ""}`);
}

export function fetchLibraryInfo() {
  return request<LibraryInfo>("/api/library");
}

export function fetchPreferences() {
  return request<Preferences>("/api/preferences");
}

/** Merge-update: only the given keys change. Returns the full new set. */
export function savePreferences(preferences: Preferences) {
  return request<Preferences>("/api/preferences", { method: "PUT", body: preferences });
}

/** Ask the API to probe a candidate Calibre content server URL. */
export function testCalibreServer(url: string) {
  return request<CalibreServerTest>("/api/calibre/test", { method: "POST", body: { url } });
}

/** True when first-time setup hasn't been completed for this app version. */
export function needsSetup(preferences: Preferences): boolean {
  return Number(preferences[PREF_KEYS.version] ?? 0) < PREFERENCES_VERSION;
}

export function coverUrl(book: Book): string | null {
  return book.hasCover ? `${API_BASE}/api/books/${book.id}/cover` : null;
}
