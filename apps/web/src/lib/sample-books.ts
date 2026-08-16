import type { LibraryBook, Ratings } from "@/lib/api";

/**
 * The fields a fixture actually varies. Everything else on a book is filled in
 * by `book()` below — the views don't render publishers or identifiers yet, and
 * spelling them out twelve times would bury the shapes that matter.
 */
type Fixture = Pick<LibraryBook, "id" | "title" | "authors" | "formats" | "added" | "published"> &
  Partial<LibraryBook>;

function book(fixture: Fixture): LibraryBook {
  const sources = fixture.sources ?? ["calibre"];
  const coverState = fixture.coverState ?? "cached";
  // A fixture is one member unless it says otherwise, so it brings one cover —
  // its own. The two-cover case is the interesting one and is spelled out where
  // it appears (docs/features/book-details-panel.md).
  const covers = coverState === "cached" ? [{ bookId: fixture.id, source: sources[0] ?? "" }] : [];

  return {
    sources,
    coverState,
    covers,
    coverBookId: covers[0]?.bookId ?? null,
    // One row behind the work, unless a fixture is one of the matched ones.
    entries: sources.length,
    // Same as the Grimoire id unless a fixture says otherwise. Null is the
    // interesting case: a book Grimoire kept after Calibre dropped it.
    calibreId: fixture.id,
    series: null,
    seriesIndex: null,
    seriesList: [],
    tags: [],
    publisher: null,
    languages: ["eng"],
    identifiers: {},
    description: null,
    pages: null,
    coverUrl: null,
    // No re-fetch has happened in a fixture, so nothing to stamp on the URL.
    coverVersion: null,
    ...fixture,
  };
}

/**
 * Storybook fixtures — a slice of a library with the shapes the views have to
 * survive: long titles, multiple authors, series and standalones, unrated
 * books, one format and several, and a book that has left Calibre. Never
 * imported by the app.
 */
export const SAMPLE_BOOKS: LibraryBook[] = [
  book({
    id: 1,
    title: "Abaddon's Gate",
    authors: ["James S.A. Corey"],
    series: "The Expanse",
    seriesIndex: 3,
    tags: ["Science Fiction"],
    formats: ["EPUB", "PDF"],
    added: "2024-06-29T12:25:52+00:00",
    published: "2013-06-01T04:00:00+00:00",
  }),
  book({
    id: 2,
    title: "A Memory Called Empire",
    authors: ["Arkady Martine"],
    series: "Teixcalaan",
    seriesIndex: 1,
    tags: ["Science Fiction", "Space Opera"],
    formats: ["EPUB"],
    added: "2025-01-14T09:02:11+00:00",
    published: "2019-03-26T00:00:00+00:00",
  }),
  book({
    id: 3,
    title: "The Long Way to a Small, Angry Planet",
    authors: ["Becky Chambers"],
    series: "Wayfarers",
    seriesIndex: 1,
    tags: ["Science Fiction"],
    formats: ["EPUB", "MOBI", "PDF"],
    added: "2023-11-02T18:44:00+00:00",
    published: "2014-07-29T00:00:00+00:00",
  }),
  book({
    id: 4,
    title: "Piranesi",
    authors: ["Susanna Clarke"],
    tags: ["Fantasy"],
    formats: ["EPUB"],
    added: "2025-07-21T07:15:30+00:00",
    published: "2020-09-15T00:00:00+00:00",
  }),
  book({
    id: 5,
    title: "Structure and Interpretation of Computer Programs, Second Edition",
    authors: ["Harold Abelson", "Gerald Jay Sussman", "Julie Sussman"],
    tags: ["Programming", "Reference"],
    formats: ["PDF"],
    added: "2022-02-08T21:00:00+00:00",
    published: "1996-07-25T00:00:00+00:00",
  }),
  book({
    id: 6,
    title: "The Goblin Emperor",
    authors: ["Katherine Addison"],
    tags: ["Fantasy"],
    formats: ["EPUB", "AZW3"],
    added: "2024-03-30T11:11:11+00:00",
    published: "2014-04-01T00:00:00+00:00",
  }),
  // Deleted from Calibre, kept by Grimoire (ADR 0011): still has its details,
  // cover and rating, but no calibre id — so no download, and a mark saying so.
  book({
    id: 7,
    title: "Children of Time",
    authors: ["Adrian Tchaikovsky"],
    series: "Children of Time",
    seriesIndex: 1,
    tags: ["Science Fiction"],
    formats: ["EPUB"],
    added: "2023-05-19T14:20:00+00:00",
    published: "2015-06-04T00:00:00+00:00",
    calibreId: null,
  }),
  book({
    id: 8,
    title: "Gideon the Ninth",
    authors: ["Tamsyn Muir"],
    series: "The Locked Tomb",
    seriesIndex: 1,
    tags: ["Fantasy", "Science Fiction"],
    formats: ["EPUB", "PDF"],
    added: "2025-04-02T16:05:45+00:00",
    published: "2019-09-10T00:00:00+00:00",
  }),
  book({
    id: 9,
    title: "The Dispossessed",
    authors: ["Ursula K. Le Guin"],
    series: "Hainish Cycle",
    seriesIndex: 6,
    tags: ["Science Fiction", "Classics"],
    formats: ["EPUB", "MOBI"],
    added: "2021-09-09T09:09:09+00:00",
    published: "1974-05-01T00:00:00+00:00",
  }),
  book({
    id: 10,
    title: "Ancillary Justice",
    authors: ["Ann Leckie"],
    series: "Imperial Radch",
    seriesIndex: 1,
    tags: ["Science Fiction"],
    formats: ["EPUB"],
    added: "2024-12-25T08:30:00+00:00",
    published: "2013-10-01T00:00:00+00:00",
  }),
  book({
    id: 11,
    title: "Never Let Me Go",
    authors: ["Kazuo Ishiguro"],
    tags: ["Literary Fiction"],
    formats: ["EPUB", "PDF"],
    added: "2020-10-31T22:00:00+00:00",
    published: "2005-03-03T00:00:00+00:00",
  }),
  book({
    id: 12,
    title: "A Deepness in the Sky",
    authors: ["Vernor Vinge"],
    series: "Zones of Thought",
    seriesIndex: 2,
    tags: ["Science Fiction"],
    formats: ["EPUB"],
    added: "2019-07-04T12:00:00+00:00",
    published: "1999-02-01T00:00:00+00:00",
  }),
  // On a reader's Hardcover shelves and not in Calibre: no file to download, and
  // a cover that lives on their CDN (docs/features/hardcover-sync.md).
  book({
    id: 13,
    title: "The Blade Itself",
    authors: ["Joe Abercrombie"],
    series: "The First Law",
    seriesIndex: 1,
    tags: ["Fantasy"],
    formats: [],
    added: "2026-02-02T00:00:00+00:00",
    published: "2006-05-04T00:00:00+00:00",
    sources: ["hardcover"],
    calibreId: null,
    coverState: "none",
    coverUrl: null,
  }),
  // A matched book: one work, two member rows, two marks — and two covers, one
  // from each library, which is what the details panel lets you swap between
  // (docs/features/book-details-panel.md). The member ids are not the work's.
  book({
    id: 14,
    title: "Piranesi",
    authors: ["Susanna Clarke"],
    tags: ["Fantasy"],
    formats: ["EPUB"],
    added: "2025-07-21T07:15:30+00:00",
    published: "2020-09-15T00:00:00+00:00",
    sources: ["calibre", "hardcover"],
    covers: [
      { bookId: 14, source: "calibre" },
      { bookId: 114, source: "hardcover" },
    ],
    coverBookId: 14,
  }),
];

/**
 * The ratings a reader might have set, keyed by book id — separate from the
 * books because a rating belongs to a person, not to the library
 * (docs/features/rating-a-book.md). Books absent here are unrated.
 */
export const SAMPLE_RATINGS: Ratings = {
  "1": 4,
  "2": 5,
  "3": 4,
  "4": 5,
  "6": 3,
  "7": 4,
  "9": 5,
  "10": 4,
  "11": 4,
};
