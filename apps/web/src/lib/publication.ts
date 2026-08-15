/**
 * The year a book came out, from Calibre's ISO publication date. Calibre marks
 * "no date" with year 0101 rather than a null, so anything before 1000 is that
 * placeholder and not a genuinely ancient book.
 */
export function publicationYear(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  return year > 1000 ? year : null;
}
