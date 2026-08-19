---
type: feature
title: Library sort and group
description: The filter bar's first two controls, a sort dropdown and a group dropdown that splits either library view into labelled sections.
tags: [frontend, ui, library]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-15 }
---

# Library sort and group

## Summary

Two dropdowns in the [book list](book-list.md) toolbar's reserved filter
region: **Sort** reorders the library, **Group** splits it into labelled
sections. Both apply to whichever view is active and persist per device.

This is the first slice of the filter bar; filter pills (author, tags, status,
rating…) are later slices of the same row.

## Motivation

The library currently renders in the server's fixed title order. A shelf you
can't reorder answers only one question. Sorting answers "what did I add
recently?" and "what do I rate highest?", and grouping turns a flat scroll into
a browsable shelf: all of an author's books together, a series in one place.

Everything happens client-side. The whole library is already in the browser in
one call ([ADR 0011](../adrs/0011-sync-calibre-into-grimoire-db-and-read-the-library-from-there.md)),
so ordering it is a pure presentation concern, and the server's title sort is
just a stable default payload order.

## Behavior

**Sort.** One dropdown listing: Title, Author, Series, Date added, Published,
My rating. Choosing a key sorts with its natural direction, text ascending,
dates and rating descending. Choosing the active key again flips the
direction, shown as an arrow on the control. Author sorts by first author;
Series sorts by series name then series index. Books without the key (no
series, no publication date, unrated) always sort to the end, in both
directions, because "no value" is not "lowest value". "My rating" uses the
current reader's stars from whichever source they chose
([rating a book](rating-a-book.md)); with no reader chosen every book is
unrated and the order falls back to title.

Ties break invisibly, the way a shelf would be read: one author's books
cluster into their series in reading order (standalones after them), a
duplicate title keeps each author's copy together, a run of equal ratings
reads by author, and everything ends at title A→Z. Secondary order never
flips with the chosen direction. Authors Z→A still read each series #1,
#2, #3.

**Group.** A second dropdown: None, Author, Series, Read status, Published
year, Read year. Grouping splits the view into sections, each headed by a
label and a count: a header row spanning the grid, a full-width row in the
table. Sections are ordered by their own label (authors and series
alphabetically; read status Unread first, then Read; both year groupings
newest year first, because a shelf read by year is a recency question); the
sort order applies within each section. Ungrouped leftovers form a final
section, labelled "No series", "No publication date", or "No read date",
which covers both the unread and the read-but-undated. Read status and read
year use the current reader's marks
([marking a book read](marking-a-book-read.md)) from whichever source they
chose; both options are disabled until a reader is chosen.

A read year is the year the reader finished the book, taken from the local
finish date, or from Hardcover's last read date in the shelf mirror for a
reader whose read state lives there. A book read more than once files under
its most recent year, not once per read. Sections partition the shelf; they
don't multiply it. Finish dates are recorded at whatever precision the reader
gave ("2023", "2023-06-15"), so the year is always known when a date is.

A book can appear in only one section: author groups use the primary (first)
author, matching how author sort works.

**Persistence.** Both live in the URL as search parameters, so a sorted,
grouped shelf is a link ([ADR 0020](../adrs/0020-library-view-state-lives-in-the-url.md)).
The `localStorage` mirror stays, demoted to the default for a URL that
doesn't name them. Sorting is still how you hold the shelf on this device, but
an explicit parameter always wins, so a link opens the way its sender saw it.
Every control that changes the order writes to the URL, the toolbar menus and
the [command palette](command-palette.md)'s Sort and Group commands alike.
Anything writing only the mirror would be outranked by the parameter and
appear to do nothing.

**Counts.** The toolbar's book count keeps counting books, not sections.

## Acceptance criteria

- [x] The toolbar's placeholder region is replaced by working Sort and Group
      dropdowns; both views obey them without refetching.
- [x] Re-choosing the active sort key flips direction, and the control shows
      which key and direction are active.
- [x] Books missing the sorted field land at the end in either direction.
- [x] Grouping renders labelled, counted section headers in both the cover
      grid and the table, ordered by section label with the sort applied
      inside each section.
- [x] Read-status grouping is disabled with no reader chosen; rating sort
      degrades to title order rather than erroring.
- [x] Published year and read year group into year sections, newest first,
      with undated books in a final section; read year is disabled with no
      reader chosen and follows the reader's read-state source.
- [x] Sort and group choices survive a reload, per device, and round-trip
      through the URL so a link carries them.
- [x] The dropdowns and grouped views have Storybook stories.

## Open questions

- **Filter pills.** The rest of the bar is unbuilt: author, series, tags,
  format and rating filters. This feature only claims the left edge of the row.
- **Table column headers as a sort entry point.** Clicking a column header
  should probably set the matching sort key; not wired yet.
- **Series-aware sort inside author groups.** Sorting by author now reads
  each author's series in order, but grouping by author while sorting by
  title still interleaves them. The sort is the reader's explicit choice, so
  it stands. Worth revisiting if it reads badly on real shelves.
