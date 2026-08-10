// Pure type definitions, safe to import from browser code (`import type` only).

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
