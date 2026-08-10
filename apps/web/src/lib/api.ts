import {
  ApiErrorSchema,
  CalibreServerTestSchema,
  CsBooksSchema,
  CsSearchSchema,
  PreferencesSchema,
  type CalibreServerTest,
  type Preferences,
} from "@grimoire/core/schemas";
import { PREF_KEYS, PREFERENCES_VERSION } from "@grimoire/core/types";
import type { z } from "zod";

export type { CalibreServerTest, Preferences };
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
  init?: { method: string; body?: unknown },
): Promise<z.infer<S>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
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

export interface LibraryBook {
  id: number;
  title: string;
  authors: string[];
}

/**
 * The book list, from the Calibre content server through our proxy: one call
 * for the ids in sort order, a second for their metadata.
 */
export async function fetchBooks(): Promise<LibraryBook[]> {
  const search = await request("/api/cs/ajax/search?num=9999&sort=title", CsSearchSchema);
  if (search.book_ids.length === 0) return [];

  const meta = await request(
    `/api/cs/ajax/books?ids=${search.book_ids.join(",")}`,
    CsBooksSchema,
  );

  // Keep the content server's sort order; ids it didn't recognise come back null.
  return search.book_ids.map((id) => ({
    id,
    title: meta[String(id)]?.title ?? `(book ${id})`,
    authors: meta[String(id)]?.authors ?? [],
  }));
}
