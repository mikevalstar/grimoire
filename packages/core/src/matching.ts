/**
 * Reducing a title and an author to something two sources can agree on
 * (docs/features/book-matching.md). Pure string work — no database, no network
 * — so it can be reasoned about and tested on its own, and so both reconcile
 * paths normalise identically. If Calibre and Hardcover ever disagree about how
 * a title normalises, nothing matches.
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

/** Lowercase, unaccented, and free of the characters people disagree about. */
function fold(value: string): string {
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
