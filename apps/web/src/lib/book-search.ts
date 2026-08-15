import { fold, matchKey } from "@grimoire/core/matching";
import type { LibraryBook } from "@/lib/api";

/**
 * Searching the shelf in the browser. The client already holds every work
 * (`fetchBooks`), so filtering is immediate and does not need a round trip.
 * See docs/features/library-quick-filter.md and
 * docs/features/resolving-duplicates.md.
 */

/** A duplicate-picker-sized list. The library filter itself is not capped. */
const MAX_RESULTS = 25;

/** Only identifiers people conventionally use to find a book. */
const SEARCHED_IDENTIFIERS = new Set(["amazon", "isbn", "google"]);

interface SearchField {
  words: string[];
  /** Lower is stronger: title, author, series, then identifiers. */
  weight: number;
}

export interface RankedBook {
  book: LibraryBook;
  score: number;
}

export interface BookSearchOptions {
  /** A work to leave out — the book being searched *from* is not a candidate. */
  exclude?: number;
}

/**
 * The Levenshtein distance between two words. Search only calls this for
 * similarly-sized words and supplies the accepted limit for the cheap length
 * rejection.
 */
function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row++) {
    const current = [row];
    for (let column = 1; column <= b.length; column++) {
      const value = Math.min(
        (current[column - 1] ?? 0) + 1,
        (previous[column] ?? 0) + 1,
        (previous[column - 1] ?? 0) + (a[row - 1] === b[column - 1] ? 0 : 1),
      );
      current.push(value);
    }
    previous = current;
  }
  return previous[b.length] ?? limit + 1;
}

/** How well one typed token matches one metadata word; null means no match. */
function wordScore(query: string, candidate: string): number | null {
  if (candidate === query) return 0;
  if (candidate.startsWith(query)) {
    return 1 + Math.min((candidate.length - query.length) / 20, 0.9);
  }
  if (query.length >= 2 && candidate.includes(query)) return 3 + candidate.indexOf(query) / 20;

  // Short words and numbers get exact substring behavior only. Fuzzy matching
  // those produces far more coincidences than useful typo correction.
  if (query.length < 4 || !/\p{L}/u.test(query)) return null;
  const allowance = query.length >= 8 ? 2 : 1;
  const distance = editDistance(query, candidate, allowance);
  return distance <= allowance ? 7 + distance : null;
}

function fieldsFor(book: LibraryBook): SearchField[] {
  const fields: SearchField[] = [
    { words: fold(book.title).split(" ").filter(Boolean), weight: 0 },
    { words: fold(book.authors.join(" ")).split(" ").filter(Boolean), weight: 2 },
  ];
  if (book.series) fields.push({ words: fold(book.series).split(" ").filter(Boolean), weight: 4 });

  const identifiers = Object.entries(book.identifiers)
    .filter(([name]) => SEARCHED_IDENTIFIERS.has(fold(name)))
    .flatMap(([, value]) => fold(value).split(" ").filter(Boolean));
  if (identifiers.length > 0) fields.push({ words: identifiers, weight: 6 });
  return fields;
}

/** Best score for a token across every searchable field on a book. */
function tokenScore(token: string, fields: readonly SearchField[]): number | null {
  let best: number | null = null;
  for (const field of fields) {
    for (const word of field.words) {
      const score = wordScore(token, word);
      if (score !== null) best = Math.min(best ?? Number.POSITIVE_INFINITY, score + field.weight);
    }
  }
  return best;
}

/**
 * All matching books, best first, with the score exposed so the library's
 * selected sort can break relevance ties. Every query token must match, but
 * tokens can land in different fields and in any order.
 */
export function rankBooks(
  books: readonly LibraryBook[],
  query: string,
  { exclude }: BookSearchOptions = {},
): RankedBook[] {
  const folded = fold(query);
  if (!folded) return [];

  const tokens = [...new Set(folded.split(" ").filter(Boolean))];
  const found: RankedBook[] = [];

  for (const book of books) {
    if (book.id === exclude) continue;
    const fields = fieldsFor(book);
    let score = 0;
    let matches = true;

    for (const token of tokens) {
      const tokenMatch = tokenScore(token, fields);
      if (tokenMatch === null) {
        matches = false;
        break;
      }
      score += tokenMatch;
    }
    if (!matches) continue;

    // Phrase-level title matches settle the most useful close calls without
    // changing the every-token rule above.
    const title = fold(book.title);
    const queryKey = matchKey(query);
    if (queryKey !== null && queryKey === matchKey(book.title)) score -= 4;
    else if (title.startsWith(folded)) score -= 2;
    else if (title.includes(folded)) score -= 1;

    found.push({ book, score });
  }

  return found.sort((a, b) => a.score - b.score || a.book.title.localeCompare(b.book.title));
}

/**
 * Panel-sized search used by the duplicate picker. It shares the library's
 * metadata and typo-aware ranking but intentionally returns only books.
 */
export function searchBooks(
  books: readonly LibraryBook[],
  query: string,
  options: BookSearchOptions = {},
): LibraryBook[] {
  return rankBooks(books, query, options)
    .slice(0, MAX_RESULTS)
    .map((entry) => entry.book);
}
