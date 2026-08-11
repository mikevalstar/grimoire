---
type: feature
title: Book list
description: The library screen — every book in the Calibre library, shown either as a grid of covers or a dense table, with a toolbar that switches between them and holds the space filters will take.
tags: [frontend, ui, library, calibre]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-11 }
---

# Book list

## Summary

The app's home screen: every book the [Calibre content
server](../adrs/0005-calibre-content-server-as-the-data-source.md) reports,
rendered either as a grid of covers or as a dense table, with a toolbar above
that switches between the two views and reserves the space filters will
eventually occupy.

## Motivation

The [application shell](application-shell.md) framed a screen that showed a
bulleted list of titles. This is the first real library surface, and it settles
two things everything downstream depends on: how a book is represented (cover,
title, author, series, rating), and that a *view* is a swappable presentation of
one query rather than a separate screen.

Latitude asks for both a cover shelf and a list, on the grounds that they answer
different questions — browsing ("what do I feel like?") wants covers, looking
something up ("do I own this, and in what format?") wants columns. Building both
now, off one book model, keeps a third view (spines) and the filter/sort layer
from needing a rewrite.

Filters are deliberately *not* in scope; the toolbar leaves an empty region
where they go so the layout does not shift when they land.

## Behavior

### The toolbar

A single row above the library, sticky under the header:

- **Filter region** (left) — empty for now, holding its height so the library
  does not jump when filters arrive. It is a real, labelled region, not a
  margin.
- **Result count** — "255 books", tabular numerals, the same uppercase micro-
  label the design uses elsewhere.
- **View switcher** (right) — a segmented control with two segments, Covers and
  List, each an icon plus a label that hides on narrow screens. The active
  segment is marked with the user accent (`--you-*`), because which view you are
  in is your own state, not the library's.

### Covers view

An auto-filling grid with no max width — cards reflow from two columns on a
phone to as many as the window allows
([requirement 21](application-shell.md)). Each card is a cover image, then the
title, then the author, then the series line when there is one. Cards lift on
hover using the shell's spring curve. A book with a rating shows it as stars
under the author.

### List view

A table that scrolls horizontally below its minimum width rather than squeezing
columns: a thumbnail, title, author, series, rating, formats, and date added.
The header row is sticky within the scroll region. Columns are fixed for now —
the columns picker is a later feature.

### Covers

Covers come from the content server through the `/api/cs` proxy —
`/api/cs/get/thumb/<id>?sz=<w>x<h>` — so the browser never needs to reach
Calibre directly and no CORS or second origin is involved. The grid asks for a
larger thumbnail than the table does. Books with no cover (and covers that fail
to load) fall back to a drawn placeholder: the title set on a tinted panel, so a
coverless library still reads as a shelf rather than as broken images.

### View persistence

Which view you are in is per-device, kept in `localStorage` under
`grimoire.view` alongside the theme — a phone browsing the same self-hosted
library should be free to prefer covers while the desktop prefers the table. It
is not a preference in Grimoire's database.

### States

- **Loading** — a skeleton in the shape of the active view (cards or rows), not
  a spinner, so the switch does not change the page's silhouette.
- **Empty** — a short line saying the library has no books, pointing at the
  content server rather than at Grimoire.
- **Error** — the API error and its hint (the proxy already explains a
  content server that is not running), with a retry.

## Acceptance criteria

- [x] The library renders in either a cover grid or a table, and the toolbar
      switches between them without refetching.
- [x] The chosen view survives a reload and is per-device.
- [x] The toolbar reserves a labelled, empty region for filters.
- [x] Covers load through `/api/cs`, and a missing or broken cover falls back to
      a readable placeholder rather than a broken image.
- [x] Both views are full-width with no max-width clamp; the grid reflows and
      the table scrolls horizontally instead of crushing columns.
- [x] Loading, empty and error states are handled in both views.
- [x] Every new component has a Storybook story, in both themes.
- [x] The book model carries what the views show — title, authors, series,
      rating, tags, formats, dates — parsed from Calibre at the boundary by a
      shared Zod schema
      ([ADR 0009](../adrs/0009-zod-schemas-shared-between-api-and-client.md)).

## Open questions

- **Filters and sorting.** The toolbar's empty region and the fixed
  `sort=title` query are placeholders. Sorting probably belongs to the same
  feature as filtering, with the table's column headers as a second entry point.
- **Scale.** The whole library is fetched in one pass (`num=9999`) and rendered
  without virtualization. That is fine for a few thousand books and will not be
  for a hundred thousand; paging or windowing is a separate decision, and it is
  the same decision as whether filtering happens on the server.
- **Selection and detail.** Clicking a book does nothing yet — the detail panel
  is its own feature. Keyboard roving (arrow keys through the grid) waits for
  the same work.
- **Spines.** Latitude's third view is not built. Nothing here blocks it; it is
  another entry in the switcher.
- **Read status.** Calibre exposes it as a custom column in this library
  (`#read`), which is not portable across libraries, so no status glyph is shown
  yet — see the [settings](settings.md) discussion of what Grimoire stores
  itself.
