---
type: feature
title: Book details panel
description: Clicking a book on the shelf slides a panel in from the right with everything Grimoire knows about it — cover, series, your rating, the download, and the metadata the views have no room for.
tags: [frontend, ui, library]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-14 }
---

# Book details panel

## Summary

Clicking a card in the grid or a row in the table opens a panel from the right
edge holding one book: its cover, title, authors and series, the marks saying
where it came from, your stars, the download, and the metadata neither view has
room to show — publisher, publication date, languages, page count, identifiers,
tags and the description.

Everything on it is data Grimoire already stores
([ADR 0011](../adrs/0011-sync-calibre-into-grimoire-db-and-read-the-library-from-there.md)),
and nothing on it writes to Calibre.

## Motivation

The [book list](book-list.md) has been showing a fraction of each book. A card
can carry a title, an author, a series line and five stars before it stops being
a shelf; the table gets a few more columns and then starts scrolling sideways.
The rest of what sync already pulled in — the description most of all — has had
nowhere to go, and clicking a book has done nothing at all.

A flyout rather than a page: looking a book up is a glance in the middle of
browsing, and taking the whole window away to do it loses the reader's place on
the shelf. It also keeps the shelf's own state — scroll position, which view,
where the pointer was — untouched, which a route change would not.

This is deliberately the light version. It gives the click somewhere to land and
puts the stored metadata on screen; the ambitions in the design idea (a series
strip, crowd ratings from [Hardcover](hardcover-sync.md), private notes, shelves,
read status, format conversion) each need data or writes Grimoire does not have
yet, and are listed under open questions rather than stubbed.

## Behavior

**Opening.** Clicking a card or a row opens the panel for that book. The
controls already on a card — the stars and the download button — swallow their
own clicks, so rating a book or fetching a file never also opens it.

**The panel.** A modal flyout on the right, full width on a phone and a fixed
column from `sm` up, widening again on a large screen — it is a page's worth of
metadata rather than a form, and has more to hold yet. Text that is read rather
than scanned keeps a readable measure instead of running the panel's full width.
It sits over a scrim that dims the shelf behind it. The book's own
cover, blurred, lights the top of the panel — the same ambient trick
[the shell](application-shell.md) uses on the canvas, here tinted by whatever
the reader clicked.

Its contents, in order:

- **Header** — cover, title, authors, series and index, and the
  [marks](book-list.md) saying which sources the book came from.
- **The cover stack** — when the work has more than one cover, see below.
- **Your rating** — the same control as on the shelf
  ([rating a book](rating-a-book.md)), at a larger size and always visible
  rather than revealed on hover: the panel is already about one book, so there
  is nothing to reveal it *against*.
- **Download** — the same button, labelled here, offering every format when
  there is a choice. Absent, with a line saying why, for a book that has left
  the Calibre library or that has no files.
- **Same book** — the entries this work is made of, and the ones that look like
  they belong in it, with a click to say either way. Absent for a book with one
  entry and no candidates, which is nearly all of them. See
  [resolving duplicates](resolving-duplicates.md).
- **Details** — publisher, published, added, languages, pages, formats, and any
  identifiers (ISBN and friends). A field Grimoire has no value for is left out
  rather than shown as a dash; the panel is not a form.
- **Tags** — Calibre's, as plain chips. They are not filters yet.
- **About** — the description.

### Choosing a cover

A work grouped from two sources ([ADR 0013](../adrs/0013-group-duplicate-books-into-works.md))
usually has **two covers on disk** — the edition in Calibre and the one
hardcover.app holds — because [sync](hardcover-sync.md) caches every member's.
Which one appeared was a rule nobody chose: Calibre's, always.

In the panel those covers are drawn as a **stack of papers**: the current one
face up, the others tilted behind it with a badge counting them. Clicking turns
the next one over, and that is the whole interaction — no menu, no modal, and
nothing for a book with a single cover, which is nearly all of them.

The turn is animated: the top sheet flicks aside and drops to the back of the
pile while the next rises to face up, passing each other half way. The write is
optimistic and otherwise silent, so — as with [rating](rating-a-book.md) — the
motion is the acknowledgement that the click landed. It is `motion-safe` only;
under reduced motion the covers simply trade places.

The choice is stored **on the work, for everyone**: a cover is what a book looks
like, not an opinion about it, so it does not belong to a reader the way a
[rating](rating-a-book.md) does. It survives sync, since reconcile never touches
it, and it reverts to the rule by itself if the chosen member ever loses its
cover.

Two consequences worth stating:

- **A member row id crosses to the browser.** Covers were addressed by *work*
  id precisely so the client never learned that member rows exist; choosing
  between them means naming them. An index into the list would have kept that
  secret and would have shifted under a sync while a panel was open.
- **The chosen member is stamped on the cover URL.** Covers are served with a
  year-long `max-age`, so an unchanged URL would go on showing the old cover
  after a swap.

**The description is text, not markup.** Calibre stores comments as HTML, and
Grimoire mirrors it verbatim. The panel renders it as plain paragraphs: tags are
stripped, block boundaries become paragraph breaks. Injecting a library's stored
HTML into the app is a hole for the sake of italics, and the alternative — a
sanitizer — is a dependency and a maintenance surface this feature does not
need.

**Closing.** Escape, the close button, or clicking the scrim. Focus returns to
the card or row that opened it.

**Nothing here is editable** except the rating. Grimoire is read-only against
Calibre ([ADR 0005](../adrs/0005-calibre-content-server-as-the-data-source.md)),
so a title that could be typed into would be a promise it could not keep.

**Which book is open is screen state, not a route.** The flyout is transient and
the shelf underneath it is unchanged; a URL for it can wait for the same work
that puts filters and sorting in the URL.

## Acceptance criteria

- [x] Clicking a card or a row opens the panel for that book, in both views.
- [x] The stars and the download button on a card do not open the panel.
- [x] The panel shows the cover, title, authors, series, marks, rating,
      download, details, tags and description — omitting what the book has no
      value for.
- [x] The rating in the panel is the same reader-scoped control as on the shelf,
      and setting it there updates the card behind it.
- [x] The description renders as text; stored HTML is never injected.
- [x] A book with no Calibre id offers no download and says why.
- [x] Escape, the close button and the scrim all close it, and focus returns to
      whatever opened it.
- [x] A work with two cached covers shows them stacked, and clicking swaps
      which is shown — on the shelf behind the panel too, without a refetch.
- [x] The choice survives a reload and a sync, applies to every reader, and
      falls back to the rule if the chosen member loses its cover.
- [x] A book with one cover shows no stack and offers nothing to click.
- [x] The turn animates, replays on a second click, and does neither under
      reduced motion.
- [x] The cover routes refuse a member that is not part of the work.
- [x] The panel and the cover stack have Storybook stories, in both themes.

## API

`GET /api/books` carries each work's `covers` (one entry per member that has a
cached file) and `coverBookId` (the one being shown).
`GET /api/books/:id/cover/:size?member=` serves a named member's file, and
`PUT /api/books/:id/cover` stores the choice, answering with the updated book —
404 for a book that is not a member of the work or has no cover. Both payloads
are shared Zod schemas
([ADR 0009](../adrs/0009-zod-schemas-shared-between-api-and-client.md)).

## Open questions

- **Deep links.** No URL names an open book, so the panel cannot be linked or
  restored on reload. Worth doing with filters and sorting, which want the URL
  for the same reason.
- **Moving between books.** No next/previous, and no keyboard roving on the
  shelf behind — the same gap [book list](book-list.md) already records.
- **Uploading a cover.** The stack offers what the sources brought, and nothing
  else. A cover from disk or a URL would be a third kind of member row
  (`grimoire`), which is a bigger decision than this feature.
- **The series strip.** Showing the whole series with the books you own filled
  in needs series to be a queryable thing rather than a string on each book.
- **Crowd data.** Ratings, reader counts and the "you vs the crowd" line in the
  design idea wait on [Hardcover sync](hardcover-sync.md) storing per-book
  aggregates, which it does not yet.
- **Reading and read status.** Both are absent from the panel because they are
  absent from Grimoire; a "Read now" button needs a reader, and status needs a
  portable place to store it.
- **Notes and shelves.** Per-reader data the panel is the obvious home for, once
  either exists.
