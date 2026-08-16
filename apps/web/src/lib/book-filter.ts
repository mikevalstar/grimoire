import { fold } from "@grimoire/core/matching";
import type { LibraryBook } from "@/lib/api";

/**
 * The filter box's little query language: `author:…` and `series:…` terms,
 * semicolons between them, and anything left over as free text for the ranked
 * search in book-search.ts. See docs/features/library-quick-filter.md.
 *
 * Semicolons rather than spaces separate the terms because the values are
 * names, and names have spaces in them.
 */

/** The fields a term can name. Adding one is a line here and a line in `fieldValues`. */
export const FILTER_FIELDS = ["author", "series"] as const;

export type FilterField = (typeof FILTER_FIELDS)[number];

/** One `field:value`, folded for matching and kept as typed for reading back. */
export interface FilterTerm {
  readonly folded: string;
  readonly label: string;
}

export interface ParsedFilter {
  /** The segments that weren't terms, rejoined — the ranked search's query. */
  readonly text: string;
  /** Terms per field. Same field ORs, different fields AND. */
  readonly terms: Readonly<Record<FilterField, readonly FilterTerm[]>>;
  /** Whether any term was found — the caller skips the whole pass without one. */
  readonly hasTerms: boolean;
}

const FIELDS: ReadonlySet<string> = new Set(FILTER_FIELDS);

/** `field:value`, with room around the colon. The value runs to the end of its segment. */
const TERM = /^([a-zA-Z]+)\s*:\s*(.+)$/;

/**
 * Split a query into its terms and its free text.
 *
 * An unrecognised `word:` prefix is deliberately *not* a term — it stays free
 * text, so a typo narrows nothing rather than silently matching nothing.
 */
export function parseFilterQuery(query: string): ParsedFilter {
  const terms: Record<FilterField, FilterTerm[]> = { author: [], series: [] };
  const text: string[] = [];
  let hasTerms = false;

  for (const raw of query.split(";")) {
    const segment = raw.trim();
    if (!segment) continue;

    const match = TERM.exec(segment);
    const field = match?.[1]?.toLowerCase();
    const label = match?.[2]?.trim() ?? "";
    const folded = fold(label);
    if (field && FIELDS.has(field) && folded) {
      terms[field as FilterField].push({ folded, label });
      hasTerms = true;
    } else {
      text.push(segment);
    }
  }

  return { text: text.join(" "), terms, hasTerms };
}

/** The folded strings one field offers a term to match against. */
function fieldValues(book: LibraryBook, field: FilterField): string[] {
  switch (field) {
    case "author":
      return book.authors.map(fold);
    // Every series the book belongs to, not only the one heading its line
    // (ADR 0019) — plus the plain string, for a library between an upgrade and
    // its next sync.
    case "series": {
      const names = book.seriesList.map((entry) => fold(entry.name));
      if (book.series) names.push(fold(book.series));
      return names;
    }
  }
}

/**
 * Whether a book satisfies every field in the parse: at least one of that
 * field's terms matches one of its values, by folded substring — `le guin`
 * finds "Ursula K. Le Guin", and a whole name pasted in by a click finds
 * itself.
 */
export function matchesFilterTerms(book: LibraryBook, parsed: ParsedFilter): boolean {
  for (const field of FILTER_FIELDS) {
    const wanted = parsed.terms[field];
    if (wanted.length === 0) continue;
    const values = fieldValues(book, field);
    if (!wanted.some((term) => values.some((value) => value.includes(term.folded)))) return false;
  }
  return true;
}

/**
 * The query text a click on an author or a series name puts in the box. The
 * separator can't survive inside a value, so it becomes a space rather than
 * quietly splitting the name into two terms.
 */
export function filterTerm(field: FilterField, value: string): string {
  return `${field}:${value.replaceAll(";", " ").replace(/\s+/g, " ").trim()}`;
}

/** How a parse reads back to a person — the no-matches message's words. */
export function describeFilter(parsed: ParsedFilter): string[] {
  const parts: string[] = [];
  if (parsed.text) parts.push(`“${parsed.text}”`);
  for (const field of FILTER_FIELDS) {
    for (const term of parsed.terms[field]) parts.push(`${field} “${term.label}”`);
  }
  return parts;
}
