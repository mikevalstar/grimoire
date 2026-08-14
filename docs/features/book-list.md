---
type: feature
title: Book list
description: The library screen — every book Grimoire knows about, shown either as a grid of covers or a dense table, with a toolbar that switches between them and holds the space filters will take.
tags: [frontend, ui, library, calibre]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-11 }
---

# Book list

## Summary

The app's home screen: every book Grimoire knows about — synced from the
[Calibre content server](../adrs/0005-calibre-content-server-as-the-data-source.md)
into its own database ([ADR 0011](../adrs/0011-sync-calibre-into-grimoire-db-and-read-the-library-from-there.md))
— rendered either as a grid of covers or as a dense table, with a toolbar above
that switches between the two views.

## Motivation

This is the first real library surface, and it settles two things everything
downstream depends on: how a book is represented (cover, title, author, series,
rating), and that a *view* is a swappable presentation of one query rather than
a separate screen.

Both views exist because they answer different questions — browsing ("what do I
feel like?") wants covers, looking something up ("do I own this, and in what
format?") wants columns. Building both off one book model keeps a third view
(spines) and the filter/sort layer from needing a rewrite.

Filters are deliberately *not* in scope; the toolbar reserves the space they
will occupy so the layout does not shift when they land.

## Behavior

**The toolbar.** One sticky row above the library: a labelled but empty filter
region holding its height for later, the result count, and a view switcher
marked in the user accent — which view you are in is your own state, not the
library's.

**Covers view.** An auto-filling grid with no max width, reflowing from two
columns on a phone to as many as the window allows. Each card is a cover, title,
author, series line, and the stars — which are a control, not a read-out
([rating a book](rating-a-book.md)). Every card spends the same number of lines
on metadata whether or not the book has a series, so cards are the same height
and the stars line up across a row where they can be aimed at.

**List view.** A table that scrolls horizontally rather than crushing columns:
thumbnail, title, author, series, your rating, formats, date added, and a
trailing actions column. Columns are fixed for now; a picker is a later feature.

**Marks.** Small icons in the bottom-left corner of a cover — and beside the
title in list view, which has no corner to use — saying where the book came
from and what has happened to it since: in Calibre, on someone's
[Hardcover](hardcover-sync.md) shelves, or kept by Grimoire after Calibre
dropped it.

A book carries a *list* of marks, not one: a card is a work, and a work is every
row [matching](book-matching.md) decided is the same book, so one held in both
libraries shows both marks
([ADR 0013](../adrs/0013-group-duplicate-books-into-works.md)). The same list is
where anything else worth stating about a book — owned, borrowed, unmatched —
would go.

Icons only, with the name in the tooltip and in the accessible name. Nearly
every book in a Calibre library carries the same mark, and a list of two hundred
rows each spelling out "Calibre" is a word repeated until it stops being read,
while the icons still separate the handful saying something else. Books with no
cover reserve that corner in their placeholder, so a mark never lands on the
title standing in for one.

**Hover.** Pointing at a book is how it offers to do something. A card lifts and
takes the user accent; a row takes a raised fill; in both, a download button
fades into place and the stars come up from hollow. Two rules hold this
together, and they apply to every hover affordance Grimoire adds:

- **Nothing appears on hover that a keyboard can't reach.** Revealed controls
  are real links and buttons in the tab order, and show themselves on focus
  exactly as on hover.
- **Hover never moves anything a click is aimed at.** Revealed controls occupy
  their space from the start and only fade in; the actions column holds its
  width; motion is `motion-safe` only.

**Downloading.** The download button hands over the file straight from Calibre
through the `/api/cs` proxy, which names it. This is the one thing on the shelf
still fetched live, and it needs a *Calibre* id — so a book that has left the
library shows no download button and says why ([Calibre sync](calibre-sync.md)).
Grimoire kept the record; the file was always Calibre's.

The button answers to how many formats a book has: one format downloads
directly, several open a menu of them most-portable-first, none shows no button.
Guessing a format silently is the wrong guess for a reader who came for the PDF;
the cost is a click, and only on books that actually have a choice.

**Covers** come from Grimoire's own cache, fetched and scaled ahead of time by
[sync](calibre-sync.md), so the shelf draws with the content server stopped.
Each view asks for the nearest of three fixed sizes rather than arbitrary
pixels. A book with no cover — or one sync hasn't reached — falls back to a
drawn placeholder, so a coverless library reads as a shelf rather than as broken
images.

**View persistence.** Which view you are in is per-device, kept in
`localStorage` alongside the theme, not in Grimoire's database.

**States.** Loading is a skeleton in the shape of the active view, so switching
does not change the page's silhouette. Empty points at the content server rather
than at Grimoire. Error shows the API's own message and hint, with a retry.

## Acceptance criteria

- [x] The library renders in either a cover grid or a table, and the toolbar
      switches between them without refetching.
- [x] The chosen view survives a reload and is per-device.
- [x] The toolbar reserves a labelled, empty region for filters.
- [x] Covers load from Grimoire's own cache, and a missing or broken cover falls
      back to a readable placeholder.
- [x] Both views are full-width; the grid reflows and the table scrolls
      horizontally instead of crushing columns.
- [x] Loading, empty and error states are handled in both views.
- [x] Every hover affordance is reachable — and visible — from the keyboard, and
      hovering never reflows the library.
- [x] The download button fetches a real file named by Calibre, offers every
      format when there is a choice, and is absent for a book with none.
- [x] The book model carries what the views show, validated by a shared Zod
      schema ([ADR 0009](../adrs/0009-zod-schemas-shared-between-api-and-client.md)).
      Ratings are deliberately not among them: they are per-reader
      ([rating a book](rating-a-book.md)).
- [x] Every new component has a Storybook story, in both themes.

## Open questions

- **Books from two sources share one shelf.** A book in both Calibre and
  hardcover.app is one card carrying both marks — unless
  [matching](book-matching.md) can't tell they are the same book, in which case
  it is two, and stays two until manual resolution exists.

- **Filters and sorting.** The toolbar's empty region and the fixed sort are
  placeholders. Sorting probably belongs to the same feature as filtering, with
  the table's column headers as a second entry point.
- **Scale.** The whole library is returned in one pass and rendered without
  virtualization — fine for a few thousand books, not for a hundred thousand.
  Paging or windowing is the same decision as whether filtering happens on the
  server, and it is now Grimoire's decision to make in SQL rather than one
  inherited from Calibre's query vocabulary.
- **Selection and detail.** Clicking a book opens the
  [details panel](book-details-panel.md). Keyboard roving through the grid is
  still missing, and would fix a tab order that currently stops at every
  download link.
- **Reading.** Calibre's own web viewer can't be reached through the proxy, so
  there is nothing to point a "Read now" action at until Grimoire has a reader.
- **Spines.** Latitude's third view is not built; nothing here blocks it.
- **Read status.** Calibre exposes it as a custom column, which is not portable
  across libraries, so no status glyph is shown yet.
