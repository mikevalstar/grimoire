import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Book, LibraryInfo } from "./types.ts";

export class LibraryNotFoundError extends Error {
  constructor(readonly libraryPath: string) {
    super(`No Calibre library found at "${libraryPath}" (missing metadata.db)`);
    this.name = "LibraryNotFoundError";
  }
}

export function defaultLibraryPath(): string {
  return process.env.CALIBRE_LIBRARY ?? join(homedir(), "Calibre Library");
}

export interface ListBooksOptions {
  search?: string;
  limit?: number;
  offset?: number;
}

interface BookRow {
  id: number;
  title: string;
  sortTitle: string | null;
  path: string;
  hasCover: number;
  series: string | null;
  seriesIndex: number | null;
  rating: number | null;
  pubdate: string | null;
  addedAt: string | null;
  authors: string | null;
  tags: string | null;
  formats: string | null;
}

const BOOK_SELECT = `
  SELECT
    b.id,
    b.title,
    b.sort AS sortTitle,
    b.path,
    b.has_cover AS hasCover,
    b.series_index AS seriesIndex,
    b.pubdate,
    b.timestamp AS addedAt,
    (SELECT GROUP_CONCAT(a.name, '|') FROM books_authors_link bal
       JOIN authors a ON a.id = bal.author WHERE bal.book = b.id) AS authors,
    (SELECT s.name FROM books_series_link bsl
       JOIN series s ON s.id = bsl.series WHERE bsl.book = b.id) AS series,
    (SELECT r.rating FROM books_ratings_link brl
       JOIN ratings r ON r.id = brl.rating WHERE brl.book = b.id) AS rating,
    (SELECT GROUP_CONCAT(t.name, '|') FROM books_tags_link btl
       JOIN tags t ON t.id = btl.tag WHERE btl.book = b.id) AS tags,
    (SELECT GROUP_CONCAT(d.format, '|') FROM data d WHERE d.book = b.id) AS formats
  FROM books b
`;

const SEARCH_WHERE = `
  WHERE $search IS NULL
    OR b.title LIKE '%' || $search || '%'
    OR EXISTS (
      SELECT 1 FROM books_authors_link bal
        JOIN authors a ON a.id = bal.author
      WHERE bal.book = b.id AND a.name LIKE '%' || $search || '%'
    )
`;

function toBook(row: BookRow): Book {
  return {
    id: row.id,
    title: row.title,
    sortTitle: row.sortTitle,
    authors: row.authors ? row.authors.split("|") : [],
    series: row.series,
    seriesIndex: row.series !== null ? row.seriesIndex : null,
    rating: row.rating !== null ? row.rating / 2 : null,
    tags: row.tags ? row.tags.split("|") : [],
    formats: row.formats ? row.formats.split("|") : [],
    path: row.path,
    hasCover: row.hasCover === 1,
    pubdate: row.pubdate,
    addedAt: row.addedAt,
  };
}

/**
 * Read-only access to a Calibre library directory (the folder containing
 * metadata.db). Calibre remains the source of truth for now; we never write.
 */
export class CalibreLibrary {
  readonly path: string;
  private db: Database;

  constructor(path: string = defaultLibraryPath()) {
    this.path = path;
    const dbPath = join(path, "metadata.db");
    if (!existsSync(dbPath)) {
      throw new LibraryNotFoundError(path);
    }
    this.db = new Database(dbPath, { readonly: true });
  }

  info(): LibraryInfo {
    const row = this.db.query("SELECT COUNT(*) AS n FROM books").get() as { n: number };
    return { path: this.path, bookCount: row.n };
  }

  listBooks(options: ListBooksOptions = {}): { books: Book[]; total: number } {
    const search = options.search?.trim() || null;
    const limit = Math.min(options.limit ?? 100, 500);
    const offset = options.offset ?? 0;

    const rows = this.db
      .query(`${BOOK_SELECT} ${SEARCH_WHERE} ORDER BY b.sort LIMIT $limit OFFSET $offset`)
      .all({ $search: search, $limit: limit, $offset: offset }) as BookRow[];

    const total = (
      this.db
        .query(`SELECT COUNT(*) AS n FROM books b ${SEARCH_WHERE}`)
        .get({ $search: search }) as { n: number }
    ).n;

    return { books: rows.map(toBook), total };
  }

  getBook(id: number): Book | null {
    const row = this.db
      .query(`${BOOK_SELECT} WHERE b.id = $id`)
      .get({ $id: id }) as BookRow | null;
    return row ? toBook(row) : null;
  }

  coverPath(book: Book): string {
    return join(this.path, book.path, "cover.jpg");
  }

  close(): void {
    this.db.close();
  }
}
