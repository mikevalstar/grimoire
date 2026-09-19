---
type: feature
title: Library format filter
description: A multi-select dropdown on the filter bar that narrows the shelf to books held in chosen file formats, shown only when the library holds more than one.
tags: [frontend, ui, library, calibre]
status: draft
generated: { by: okq/0.8.0, at: 2026-09-19 }
---

# Library format filter

## Summary

A dropdown after the [source filter](library-source-filter.md) on the
[book list](book-list.md) toolbar. It narrows the shelf to books that have a
file in chosen formats: EPUB, MOBI, PDF, whatever the library holds. It appears
only when the library holds files in more than one format.

## Motivation

A reader loading a Kindle wants the MOBI and AZW3 books, one loading an e-ink
tablet wants the EPUBs, and someone tidying up wants to see what is still only
a PDF. Every book already lists its formats in the
[table view](book-list.md), so the filter groups something the reader can
already see, the same way the source filter does.

A library with one format has nothing to choose between, so the control is
absent rather than present-and-pointless.

## Behavior

The control shares its shape with the [source filter](library-source-filter.md):
a dropdown of checkboxes, one per format *present in the current library*,
never a fixed list. Formats are named as Calibre names them, in upper case,
sorted alphabetically.

Selecting nothing means everything: the shelf starts unfiltered, the trigger
reads "Format", and an explicit **All formats** item at the top of the menu
returns to that state. Clearing the last checked format falls back to all
rather than emptying the shelf. When the reader picks a real subset, the
trigger takes the user accent and names the choice. One format gets its name,
several get a count.

A work's formats are every format any of its members holds: Calibre's files
and the ones [uploaded into Grimoire](uploading-a-book.md) alike. The shelf
shows a work when *any* of its formats is selected. A book with no file at all,
such as one known only from a [Hardcover](hardcover-sync.md) shelf, never
matches a format selection.

The filter is browser-side and composes with the rest of the toolbar in a
fixed order: text search, then source, then format, then read status. So the
**All / To read / Read** counts describe the currently selected formats and
move when the selection does.

The control hides itself, and drops any selection, while the library holds
files in one format or none. The selection travels in the URL
([ADR 0020](../adrs/0020-library-view-state-lives-in-the-url.md)) as a
comma-joined `formats` parameter, so a link can name formats the recipient's
library has never had. Grimoire ignores those names rather than emptying the
shelf.

## Acceptance criteria

- [x] A multi-select format dropdown sits after the source filter, and is
      absent when the library has fewer than two distinct formats.
- [x] The menu lists only formats present in the library, plus an
      "All formats" reset.
- [x] The trigger takes the accent and names the selection whenever it is not
      "all".
- [x] A work with several formats, across any of its members, shows under any
      of them.
- [x] The read-status counts and the shelf both reflect the selected formats.
- [x] Unchecking the last selected format restores all formats rather than
      emptying the shelf.
- [x] The source and format filters are one control with two sets of options,
      not two implementations.
- [x] The control has a Storybook story, in both themes.

## Open questions

- Whether "no file" deserves an option of its own, for the reader asking what
  they have on a shelf but do not own. The source filter answers most of that
  today.
- Whether a format the library holds only through uploads should be marked as
  such in the menu.
