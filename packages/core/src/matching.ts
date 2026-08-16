/**
 * Reducing a title and an author to something two sources can agree on
 * (docs/features/book-matching.md). Pure string work — no database, no network
 * — so it can be reasoned about and tested on its own, and so both reconcile
 * paths normalise identically. If Calibre and Hardcover ever disagree about how
 * a title normalises, nothing matches.
 *
 * Also the third browser-safe module (`@grimoire/core/matching`, alongside
 * `/schemas` and `/types`): the duplicate picker searches the shelf with the
 * same normalisation the matcher groups by, so
 * `Blade Itself, The` finds `The Blade Itself` there too
 * (docs/features/resolving-duplicates.md). Nothing bun-only may be imported
 * here.
 */

/**
 * Dropped from either end of a title: one source alphabetises and the other
 * doesn't, so the same book arrives as `The Blade Itself` and
 * `Blade Itself, The`. The comma is already a space by the time this runs.
 */
const LEADING_ARTICLE = /^(the|a|an)\s+/;
const TRAILING_ARTICLE = /\s+(the|a|an)$/;

/**
 * Edition noise. One source's "Structure and Interpretation of Computer
 * Programs, Second Edition" is the other's "Structure and Interpretation of
 * Computer Programs", and they are the same book.
 */
const EDITION_NOISE =
  /\b((\d+(st|nd|rd|th)|first|second|third|fourth|revised|anniversary|collectors?|deluxe|expanded)\s+(edition|ed)|edition|unabridged|abridged|illustrated|annotated|boxed set|box set)\b/g;

/** Bracketed suffixes — `(The Expanse #3)`, `[Illustrated]` — series, mostly. */
const BRACKETED = /[([{][^)\]}]*[)\]}]/g;

/** Everything that isn't a letter, a number or a space. */
const PUNCTUATION = /[^\p{L}\p{N}]+/gu;

/**
 * Lowercase, unaccented, and free of the characters people disagree about.
 *
 * Exported for the duplicate picker's search, which has to fold a half-typed
 * query the same way the keys it is searching were folded — a search box that
 * normalises differently from the index behind it is a search box that misses
 * things for reasons nobody can see.
 */
export function fold(value: string): string {
  return (
    value
      .normalize("NFKD")
      // Strip the combining marks NFKD just split off, so "Solāris" meets "Solaris".
      .replace(/\p{M}+/gu, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(PUNCTUATION, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * The key two books have to share to be considered the same book. Null when
 * there is nothing left to match on, which is a book that never matches rather
 * than one that matches every other untitled book.
 *
 * Note the order: brackets go before punctuation is flattened, because once
 * `(The First Law #1)` loses its parentheses it is just words in the title.
 */
export function matchKey(title: string | null | undefined): string | null {
  if (!title) return null;

  const key = fold(title.replace(BRACKETED, " "))
    .replace(EDITION_NOISE, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(LEADING_ARTICLE, "")
    .replace(TRAILING_ARTICLE, "");

  return key || null;
}

/**
 * What a series name is called when it is the same series said differently.
 * Calibre stores a series as free text typed by whoever tagged the book, so one
 * shelf holds "Discworld", "Discworld Novels" and "The Discworld Series" —
 * three strings, one series, three groups on the shelf.
 *
 * Dropped from the end because they say "this is a series", which is already
 * known by the time anything is asking. Deliberately narrow: a word that could
 * name a real series is not on the list, and nothing here touches the middle of
 * a name — "The Book of the New Sun" keeps every word it needs.
 */
const SERIES_NOISE = /\s+(series|novels?|books?|saga|cycle|sequence|trilogy|chronicles?)$/;

/**
 * The identity of a series that Hardcover has not named (ADR 0019). Folded like
 * a title, then stripped of a leading article and the words above, so Calibre's
 * spellings of one series land on one row.
 *
 * Null when nothing survives — a series called "The Series" is not a series
 * name, and folding it to nothing is better than filing books under "".
 */
export function seriesKey(name: string | null | undefined): string | null {
  if (!name) return null;

  let key = fold(name).replace(LEADING_ARTICLE, "");
  // Repeatedly, because "The Discworld Series Books" is one name away from real
  // and each pass can only see the last word.
  let previous = "";
  while (key !== previous) {
    previous = key;
    key = key.replace(SERIES_NOISE, "");
  }

  return key.trim() || null;
}

/**
 * The shortest a match key can be and still be worth treating as the start of
 * another one. `It` and `Us` are books; they are also the beginning of most
 * sentences, and suggesting every title starting with "it" helps nobody.
 */
const MIN_PREFIX_KEY = 4;

/**
 * Every match key this one *extends*, at a word boundary — `dune the graphic
 * novel` yields `dune` and `dune the`. Used to find the book a subtitled
 * edition is a subtitled edition *of*
 * (docs/features/resolving-duplicates.md), which exact key equality cannot see.
 *
 * Word boundaries only: a prefix that stops mid-word is a coincidence, not a
 * title. The key itself is not included — that is the exact match, found
 * separately.
 */
export function keyPrefixes(key: string): string[] {
  const words = key.split(" ").filter(Boolean);
  const prefixes: string[] = [];

  for (let count = 1; count < words.length; count++) {
    const prefix = words.slice(0, count).join(" ");
    if (prefix.length >= MIN_PREFIX_KEY) prefixes.push(prefix);
  }
  return prefixes;
}

/** Whether a key is long enough to be worth matching another one's start against. */
export function isPrefixable(key: string): boolean {
  return key.length >= MIN_PREFIX_KEY;
}

/**
 * The surnames a book's authors are known by — what a title match is verified
 * against, so two different books sharing a title stay apart.
 *
 * The last word, because that is the part both sources spell the same way:
 * `James S.A. Corey` and `James S. A. Corey` both end in `corey`.
 *
 * `Corey, James S.A.` — Calibre's sort form, which turns up in author fields —
 * is read from before the comma instead, or every sort-ordered author would
 * reduce to their first name. Both forms then take their *last* word, so
 * `Ursula K. Le Guin` and `Le Guin, Ursula K.` agree on `guin`. Dropping the
 * particle is linguistically wrong and is the only way the two forms converge;
 * the rule has to be consistent, not correct.
 */
export function authorSurnames(authors: readonly string[]): Set<string> {
  const surnames = new Set<string>();

  for (const author of authors) {
    // Sort form: everything before the comma is the surname.
    const name = author.includes(",") ? (author.split(",")[0] ?? "") : author;
    const parts = fold(name).split(" ").filter(Boolean);
    const surname = parts[parts.length - 1];
    if (surname) surnames.add(surname);
  }

  return surnames;
}

/**
 * Whether two books are by the same person, as far as anything here can tell:
 * one shared surname is enough, because sources disagree about co-authors,
 * translators and narrators. Two books with no authors between them are never
 * the same book — that is a candidate for a human, not a match.
 */
export function sharesAuthor(a: readonly string[], b: readonly string[]): boolean {
  const first = authorSurnames(a);
  if (first.size === 0) return false;

  for (const surname of authorSurnames(b)) {
    if (first.has(surname)) return true;
  }
  return false;
}
