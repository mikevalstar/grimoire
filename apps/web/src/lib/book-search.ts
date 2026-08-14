import { fold, matchKey } from "@grimoire/core/matching";
import type { LibraryBook } from "@/lib/api";

/**
 * Searching the shelf in the browser. The client already holds every work
 * (`fetchBooks`), so finding one is a filter rather than a round trip — which is
 * what lets the duplicate picker answer while someone is still typing
 * (docs/features/resolving-duplicates.md).
 *
 * Titles are folded by the same function the matcher normalises with, so the
 * search agrees with the grouping it feeds: `Blade Itself, The` finds
 * `The Blade Itself`, and `Solaris` finds `Solāris`.
 */

/** A panel-sized list. Past this, the answer is a better query. */
const MAX_RESULTS = 25;

/** Best first: what a result matched on, which is also how results sort. */
const RANK = {
  /** The whole query normalises to this book's title. */
  key: 0,
  titleStart: 1,
  titleAnywhere: 2,
  /** Every word turned up somewhere — in the author, most likely. */
  words: 3,
} as const;

type Rank = (typeof RANK)[keyof typeof RANK];

export interface BookSearchOptions {
  /** A work to leave out — the book being searched *from* is not a candidate. */
  exclude?: number;
}

/**
 * Books matching a typed query, best match first.
 *
 * Every word of the query has to appear somewhere in the title or the authors,
 * which is forgiving of order and of half-typed words while still narrowing
 * fast. An empty query returns nothing rather than the whole library: the picker
 * opens seeded with a title, and a blank box means the reader cleared it to type
 * something else.
 */
export function searchBooks(
  books: readonly LibraryBook[],
  query: string,
  { exclude }: BookSearchOptions = {},
): LibraryBook[] {
  const folded = fold(query);
  if (!folded) return [];

  const words = folded.split(" ").filter(Boolean);
  const key = matchKey(query);

  const found: { book: LibraryBook; rank: Rank }[] = [];

  for (const book of books) {
    if (book.id === exclude) continue;

    const title = fold(book.title);
    const haystack = `${title} ${fold(book.authors.join(" "))}`;
    if (!words.every((word) => haystack.includes(word))) continue;

    found.push({
      book,
      rank:
        key !== null && key === matchKey(book.title)
          ? RANK.key
          : title.startsWith(folded)
            ? RANK.titleStart
            : title.includes(folded)
              ? RANK.titleAnywhere
              : RANK.words,
    });
  }

  return found
    .sort((a, b) => a.rank - b.rank || a.book.title.localeCompare(b.book.title))
    .slice(0, MAX_RESULTS)
    .map((entry) => entry.book);
}
