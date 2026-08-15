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
where it came from, your stars, the dates you read it, the download, and the
metadata neither view has room to show — publisher, publication date,
languages, page count, identifiers, tags and the description.

Most of it is data Grimoire already stores
([ADR 0011](../adrs/0011-sync-calibre-into-grimoire-db-and-read-the-library-from-there.md)),
while Hardcover reading history is fetched live only when a read book's panel
opens. Nothing on it writes to Calibre.

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
- **Date read** — after Same book and before Details, for a book the current
  reader has read. Every known finish date is shown, newest first, so rereads
  are not flattened into one date. In Hardcover mode the panel requests the
  reading history live when it opens rather than waiting for or extending the
  shelf mirror. Reduced-precision dates retain their meaning: a year remains a
  year and a known month is not presented as an invented first day. The section
  is absent for unread books and for reads with no known finish date.
- **Details** — publisher, published, added, languages, pages, formats, and any
  identifiers (ISBN and friends). A field Grimoire has no value for is left out
  rather than shown as a dash; the panel is not a form.
- **Tags** — as plain chips. They are not filters yet.
- **Moods** — Hardcover's mood tags, when there are any and the switch is on.
- **About** — the description.
- **View on Hardcover** — a link to the book's page on hardcover.app, for a book
  Hardcover has a side of.
- **The footer** — linking a duplicate on the left, and the gear holding the
  [book actions](book-actions.md) on the right.

### Hardcover's writing about the book

Three of the sections above — About, Tags and Moods — can come from
[Hardcover](hardcover-sync.md) instead of Calibre. Which ones is answered once,
instance-wide, by three switches in [settings](settings.md); all three are on by
default.

Where a switch is on, the panel asks Hardcover **live** when it opens, with the
current reader's token, for exactly the book the panel is showing — the same
bargain the reading history strikes: one request for an open panel is cheaper
than widening every shelf sync, and it is current at the moment somebody is
looking. Nothing fetched this way is written into the mirror.

Anything that does not arrive falls back: a book with no Hardcover side, a
reader with no linked account, an unanswered or failed request, or a switch that
is off, all leave Calibre's description and tags exactly as they were. Moods
have no Calibre equivalent, so their section is simply absent.

Tags and moods are separate on purpose. Hardcover files its tags under four
categories — Genre, Tag, Mood and Content Warning — and folding moods
("emotional", "slow-paced") into the same chip row as genres reads as noise.
Grimoire shows Genre and Tag as **Tags**, Mood as **Moods**, and leaves content
warnings alone until there is a decision about how to present them.

**Linking back to them.** A book Hardcover has a side of also gets a **View on
Hardcover** link, under the About section and above the duplicate footer, marked
with their logo. It opens `https://hardcover.app/books/<slug>` — the slug
[sync](hardcover-sync.md) already mirrors alongside every book — in a new tab,
and is absent entirely for a Calibre-only book. Unlike the three switches above,
it does not depend on a linked reader account or on any preference: the slug
comes from the mirror rather than from their API, so the link is there for any
matched book.

In the desktop shell ([ADR 0003](../adrs/0003-electrobun-for-the-desktop-shell.md))
`target="_blank"` alone does nothing — the system webview offers the request to
the host and drops it if nobody takes it. `apps/desktop` takes it: every
new-window request the webview raises is handed to the operating system's
default browser instead. That keeps the link one plain anchor in `apps/web` that
behaves the same in all three delivery targets
([ADR 0002](../adrs/0002-one-http-api-three-delivery-targets.md)), and covers
every external link added after this one.

**Their description is text, not markup either.** Hardcover's `description` is
plain text as often as not — paragraphs separated by newlines — with the
occasional publisher blurb that arrived as HTML. It goes through the same
renderer Calibre's comments do: tags stripped, block boundaries and blank lines
become paragraph breaks, entities decoded by parsing in a detached document. So
neither source can inject markup, and one code path covers both. No Markdown has
been seen from them; if it ever is, this is the place to decide whether it is
worth a renderer.

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
  after a swap. The book's `coverVersion` is stamped alongside it, for the same
  reason, when the file itself changes ([book actions](book-actions.md)).

**The description is text, not markup.** Calibre stores comments as HTML, and
Grimoire mirrors it verbatim. The panel renders it as plain paragraphs: tags are
stripped, block boundaries become paragraph breaks. Injecting a library's stored
HTML into the app is a hole for the sake of italics, and the alternative — a
sanitizer — is a dependency and a maintenance surface this feature does not
need.

**Opening takes focus to the panel, not to a control in it.** The panel is a
read-out; the sheet's default of focusing its first tabbable child would land on
the stars, previewing a rating nobody asked for and aiming the next keystroke at
it. Focus goes on the panel itself and tab walks in from the top.

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
- [x] The description renders as text; stored HTML is never injected — from
      Calibre or from Hardcover.
- [x] With the switches on, a book Hardcover knows shows their about, tags and
      moods; with them off, or for a book or reader Hardcover has nothing for,
      the panel shows Calibre's and no moods section.
- [x] A book Hardcover knows offers a link to its page on hardcover.app, which
      opens in the reader's real browser in every delivery target; a
      Calibre-only book offers none.
- [x] A book with no Calibre id offers no download and says why.
- [x] Escape, the close button and the scrim all close it, and focus returns to
      whatever opened it.
- [x] A work with two cached covers shows them stacked, and clicking swaps
      which is shown — on the shelf behind the panel too, without a refetch.
- [x] The choice survives a reload and a sync, applies to every reader, and
      falls back to the rule if the chosen member loses its cover.
- [x] A book with one cover shows no stack and offers nothing to click.
- [x] A read book shows every known finish date between Same book and Details,
      fetched live from Hardcover when that is the reader's read-state source;
      unread books show no date section.
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

`GET /api/books/:id/hardcover` is reader-scoped and answers with one book's
Hardcover description, tags and moods, read live from their API and never
stored, plus the `url` of its page on hardcover.app. A book with no Hardcover
side, or a reader with no linked account, answers with empties rather than an
error — the panel has something to fall back to either way. The `url` is the
exception that needs no token: it is built from the slug in the mirror, so it
survives an unlinked reader and a failed request.

`GET /api/books/:id/read-dates/hardcover` is reader-scoped and resolves the
work to that reader's Hardcover shelf entry, then asks Hardcover for its full
`user_book_reads` history. It returns only known finish dates at their stored
precision and does not write them into Grimoire's mirror.

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
- **Reading.** A "Read now" button still needs a reader. Read status and finish
  dates are present, but there is no in-browser reading surface yet.
- **Notes and shelves.** Per-reader data the panel is the obvious home for, once
  either exists.
