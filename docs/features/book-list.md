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

The app's home screen: every book Grimoire knows about — synced from the
[Calibre content server](../adrs/0005-calibre-content-server-as-the-data-source.md)
into its own database ([ADR 0011](../adrs/0011-sync-calibre-into-grimoire-db-and-read-the-library-from-there.md))
— rendered either as a grid of covers or as a dense table, with a toolbar above
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
title, then the author, then the series line when there is one. Under that,
the stars — which are a control, not a read-out; see
[rating a book](rating-a-book.md).

Every card spends the same number of lines on that metadata — one each for
title, author and series, reserved whether the book has them or not — and pins
the stars to the bottom. A title too long for its line truncates with an
ellipsis, as the author and series lines already do. Cards are therefore the same height
regardless of whether a book is in a series, which is what lets the stars line
up across a row and be aimed at.

### List view

A table that scrolls horizontally below its minimum width rather than squeezing
columns: a thumbnail, title, author, series, your rating, formats, date added,
and a trailing actions column. The header row is sticky within the scroll region.
Columns are fixed for now — the columns picker is a later feature.

### Hover

Pointing at a book is how it offers to do something, in both views:

- **A card** lifts on the shell's spring curve, its cover's shadow deepens into
  a second, indigo one — `--you-glow` under the card, the same pairing Latitude
  gives a focused cover, because a deeper grey shadow alone barely registers on
  a dark canvas — and the `--you-*` ring comes up with it. Its title goes to
  full contrast, and a download button fades in over the bottom of the cover.
- **A row** takes a raised fill, and the same download button fades into the
  actions column — which keeps its width whether or not anything is showing in
  it, so rows never shift sideways as the pointer moves down the table.
- **The stars**, in either view, come up from hollow and follow the pointer, so
  a book can be rated without leaving the shelf ([rating a book](rating-a-book.md)).

Two rules hold this together. **Nothing appears on hover that a keyboard can't
reach**: the download button is a real link — or, where it opens the format
menu, a real button with the menu's own arrow-key navigation — in the tab order,
and shows itself on focus exactly as it does on hover, so the affordance is not
pointer-only.
And **hover never moves anything a click is aimed at** — the button occupies its
space from the start and only fades, the lift is the card's own, and reduced-
motion users get the state change without the movement.

### Downloading

The download button hands over the book's file straight from Calibre —
`/api/cs/get/<format>/<id>` through the proxy, which already answers with the
right MIME type and a `Content-Disposition` filename, so the browser saves
"Abaddon's Gate - James S.A. Corey_152.epub" without Grimoire naming anything
itself. This is the one thing on the shelf still fetched live, and it takes a
*Calibre* id — which is why a book that has left the library shows no download
button, and a badge saying why ([Calibre sync](calibre-sync.md)). Grimoire kept
the record; the file was always Calibre's.

A book often has more than one format, and the button answers to how many:

- **One format** — the button *is* the download, a plain link, no menu in the
  way. This is most of a real library.
- **Several** — it opens a menu of them, most portable first (EPUB, AZW3, MOBI,
  PDF, then anything else alphabetically), and each entry is itself a link, so
  the browser's own save-as, middle-click and right-click all still work.
- **None** — no button at all.

Guessing silently was the earlier design, and it is the wrong guess for a reader
who came for the PDF. The cost is a click, and only on the books that actually
have a choice. The menu keeps the button visible while it is open — the pointer
has to leave the card to reach it, and the anchor cannot fade out underneath it.

### Covers

Covers come from Grimoire's own cache — `GET /api/books/<id>/cover/<size>`,
files that [Calibre sync](calibre-sync.md) fetched and scaled ahead of time — so
the shelf draws with the content server stopped. Three fixed sizes exist, and a
view asks for the nearest rather than for arbitrary pixels: the grid takes
`card`, the table takes `thumb`. Books with no cover (and covers that fail to
load, or that sync hasn't reached yet) fall back to a drawn placeholder: the
title set on a tinted panel, so a coverless library still reads as a shelf
rather than as broken images.

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
- [x] Covers load from Grimoire's own cache, and a missing or broken cover falls
      back to a readable placeholder rather than a broken image.
- [x] Both views are full-width with no max-width clamp; the grid reflows and
      the table scrolls horizontally instead of crushing columns.
- [x] Loading, empty and error states are handled in both views.
- [x] Both views answer hover with a state change, and every hover affordance is
      reachable — and visible — from the keyboard.
- [x] Hovering never reflows the library: the actions column holds its width and
      revealed controls fade rather than appear.
- [x] The lift and fade are `motion-safe` only.
- [x] The download button fetches a real file through the proxy, named by
      Calibre, and is absent for a book with no formats.
- [x] A book with several formats offers all of them in a menu, in portability
      order, in both views; a book with one downloads it directly.
- [x] Every new component has a Storybook story, in both themes.
- [x] The book model carries what the views show — title, authors, series,
      tags, formats, dates — served from `books` and validated by a
      shared Zod schema
      ([ADR 0009](../adrs/0009-zod-schemas-shared-between-api-and-client.md)).
      Ratings are deliberately not among them: they are per-reader and come
      from Grimoire's own store ([rating a book](rating-a-book.md)).

## Open questions

- **Filters and sorting.** The toolbar's empty region and the fixed
  `sort=title` query are placeholders. Sorting probably belongs to the same
  feature as filtering, with the table's column headers as a second entry point.
- **Scale.** `GET /api/books` returns the whole library in one pass and it
  renders without virtualization. That is fine for a few thousand books and will
  not be for a hundred thousand; paging or windowing is a separate decision, and
  it is the same decision as whether filtering happens on the server. It is now
  a decision Grimoire gets to make for itself, in SQL, rather than one inherited
  from Calibre's query vocabulary.
- **Selection and detail.** Clicking a book does nothing yet — the detail panel
  is its own feature, and download is the only action the shelf offers until it
  exists. Keyboard roving (arrow keys through the grid) waits for the same work,
  and would also fix the tab order: today every download link is its own tab
  stop, which is a lot of stops in a 255-book library.
- **Reading.** Latitude's hover row has a "Read now" beside download. Calibre's
  own web viewer can't be reached through the `/api/cs` proxy (its assets are
  served from paths we answer with the SPA), so there is nothing to point it at
  until Grimoire has a reader of its own.
- **Spines.** Latitude's third view is not built. Nothing here blocks it; it is
  another entry in the switcher.
- **Read status.** Calibre exposes it as a custom column in this library
  (`#read`), which is not portable across libraries, so no status glyph is shown
  yet — see the [settings](settings.md) discussion of what Grimoire stores
  itself.
