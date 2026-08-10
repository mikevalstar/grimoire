import type { Book, BookList, LibraryInfo } from "@grimoire/core/types";

export type { Book, BookList, LibraryInfo };

/**
 * Where the API lives depends on how the UI is being served:
 * - Vite dev server / hosted server: same origin ("" — /api is proxied or local)
 * - Electrobun desktop (views:// origin): the embedded server on localhost,
 *   whose port is passed via the ?apiPort query param (default 3001).
 */
function resolveApiBase(): string {
  if (window.location.protocol === "views:") {
    const port = new URLSearchParams(window.location.search).get("apiPort") ?? "3001";
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

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
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

export function coverUrl(book: Book): string | null {
  return book.hasCover ? `${API_BASE}/api/books/${book.id}/cover` : null;
}
