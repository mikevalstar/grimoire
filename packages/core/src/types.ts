// Types and plain constants shared with the browser. Nothing here may import a
// bun-only module — `apps/web` pulls this file in directly.

export interface Book {
  id: number;
  title: string;
  sortTitle: string | null;
  authors: string[];
  series: string | null;
  seriesIndex: number | null;
  /** Star rating 0–5 (calibre stores 0–10 internally; halved here). */
  rating: number | null;
  tags: string[];
  formats: string[];
  /** Book directory relative to the library root, e.g. "Author Name/Title (123)". */
  path: string;
  hasCover: boolean;
  pubdate: string | null;
  addedAt: string | null;
}

export interface BookList {
  books: Book[];
  total: number;
  limit: number;
  offset: number;
}

export interface LibraryInfo {
  path: string;
  bookCount: number;
}

/**
 * Bump when new setup is required from the user. The UI runs first-time setup
 * whenever the stored version is below this.
 */
export const PREFERENCES_VERSION = 1;

export const PREF_KEYS = {
  version: "preferences.version",
  calibreServerUrl: "calibre.serverUrl",
} as const;

/** Every preference is stored as text; callers coerce as needed. */
export type Preferences = Record<string, string>;

export interface CalibreServerTest {
  ok: boolean;
  /** Books reported by the content server, when the probe succeeded. */
  bookCount?: number;
  error?: string;
}
