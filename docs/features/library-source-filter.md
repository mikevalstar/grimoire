---
type: feature
title: Library source filter
description: A multi-select dropdown on the filter bar that narrows the shelf to books from chosen sources, shown only when the library actually has more than one.
tags: [frontend, ui, library, calibre, hardcover]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-15 }
---

# Library source filter

## Summary

A dropdown after the [quick filter](library-quick-filter.md) on the
[book list](book-list.md) toolbar, narrowing the shelf to books from chosen
sources — Calibre, [Hardcover](hardcover-sync.md), or both. It appears only when
the library holds books from more than one source.

## Motivation

Once a reader connects Hardcover, the shelf mixes books Grimoire has files for
with books it only knows about. "Show me only what I actually own" and "show me
what's on my Hardcover shelves" are both routine questions, and a source is
already on every book — it is drawn as a [mark](book-list.md) on each card — so
the filter is a grouping of something the reader can already see.

A single-source library has nothing to choose between, so the control is absent
rather than present-and-pointless.

## Behavior

The control is a dropdown of checkboxes, one per source *present in the current
library* — never a fixed list, so a source nobody uses is never offered. Sources
are named and marked with their own logos, matching the marks on the books
themselves.

Selecting nothing means everything: the shelf starts unfiltered, the trigger
reads "Source", and an explicit **All sources** item at the top of the menu
returns to that state. Clearing the last checked source falls back to all rather
than emptying the shelf. When a real subset is chosen the trigger takes the user
accent and names the choice — the source when there is one, a count when there
are several — so a narrowed shelf is never mistaken for the whole library.

A work can carry more than one source ([book matching](book-matching.md)); it is
shown when *any* of its sources is selected.

The filter is browser-side and composes with the rest of the toolbar in a fixed
order: text search, then source, then read status. So the
**All / To read / Read** counts describe the currently selected sources and move
when the selection does, exactly as they already track the text query. Sorting
and grouping apply to whatever survives.

The control is hidden — and any selection dropped — while the library holds one
source or none. The same applies to a single named source the library doesn't
hold: the selection travels in the URL
([ADR 0020](../adrs/0020-library-view-state-lives-in-the-url.md)), so a link
shared out of a mixed library can name sources its recipient's library has
never had. Those names are ignored rather than emptying the shelf.

## Acceptance criteria

- [x] A multi-select source dropdown sits after the quick filter, and is absent
      when the library has fewer than two distinct sources.
- [x] The menu lists only sources present in the library, each with its brand
      mark, plus an "All sources" reset.
- [x] The trigger is visibly accented and names the selection whenever it is not
      "all".
- [x] A book with several sources shows under any of them.
- [x] The read-status counts and the shelf both reflect the selected sources.
- [x] Unchecking the last selected source restores all sources rather than
      emptying the shelf.
- [x] The control has a Storybook story, in both themes.

## Open questions

- Whether the selection should persist per device, as the
  [view mode](book-list.md) does, or stay a per-visit choice as it is now.
- Whether the other structured filters still to come (author, tag, format,
  rating) should share this control's shape, and at what point a row of pills
  beats a row of dropdowns.
