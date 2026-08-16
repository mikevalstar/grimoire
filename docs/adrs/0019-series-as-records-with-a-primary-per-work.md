---
type: adr
title: Series as records with a primary per work
description: A series stops being a string on each book and becomes a row every work can attach to, many at a time, with one attachment marked primary for the shelf.
tags: [series, hardcover, calibre, data-model]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-16 }
---

# Series as records with a primary per work

## Status

Proposed.

## Context

A series today is two columns on a book row — `series` and `series_index` —
mirrored verbatim from Calibre and folded into a work by
[the same precedence rule every other field uses](0013-group-duplicate-books-into-works.md):
the first member that has one wins. Nothing writes them; they only ever arrive
from a sync.

That shape cannot answer the questions the app is starting to ask.

**A string is not a thing you can query.** "Show me the whole of Discworld with
the ones you own filled in" and "how many of these 41 do I have" both need the
series to exist independently of the books that name it. The
[details panel](../features/book-details-panel.md) already records the series
strip as blocked on exactly this.

**Hardcover models series properly, and a book has several.** Their `book_series`
join carries a `position` and a `featured` flag, and *Wyrd Sisters* is in
**Discworld** at #6 and in **Witches** at #2 — both true. Flattening that to one
string throws away the answer somebody wanted, and does it silently.

**Calibre's strings are not identities.** "Discworld", "The Discworld Series"
and "Discworld Novels" are three strings for one series, which is why the same
books can look unrelated on the shelf.

And [setting a series from Hardcover](../features/setting-a-series-from-hardcover.md)
wants to write one series onto a dozen works at once, which needs the series to
be a single record those works point at rather than a string copied twelve times.

## Decision

**A series is a row, and a work attaches to any number of them.**

Two new tables in `grimoire.db`
([ADR 0006](0006-grimoire-owned-sqlite-for-supplemental-data.md)):

- `series` — the series itself: `name`, `slug`, `books_count`, and a nullable
  `hardcover_id` (UNIQUE) that is the identity when Hardcover named it. A series
  Hardcover has no side of is identified by its folded name, using the same
  `fold()` the [matcher](../features/book-matching.md) already normalises titles
  with, so Calibre's three spellings of Discworld land on one row.
- `work_series` — the attachment: `work_id`, `series_id`, `position` (REAL,
  nullable — a series can hold a book whose place in it nobody has stated),
  `is_primary`, and `source`. Primary key `(work_id, series_id)`, so a work
  cannot be in one series twice, and a partial unique index on
  `work_id WHERE is_primary = 1`, so it cannot have two primaries.

**`source` on the attachment is what makes sync safe.** It holds `calibre`,
`hardcover` or `manual`. Reconcile recomputes the first two from the mirrors on
every sweep and deletes what the mirrors no longer say; it never touches a
`manual` row. That is the rule
[choosing a cover](../features/book-details-panel.md) established for
`works.cover_book_id` — a human decision outranks a source and survives every
later sync — applied to a table instead of a column.

**One attachment is primary, and it is what the shelf means by "the series".**
The primary is decided in this order, highest first:

1. A `manual` attachment — somebody said so.
2. A `hardcover` attachment, when the instance-wide **Series from Hardcover**
   preference is on. Ties break on Hardcover's `featured` flag, then on
   `books_count` — the containing series beats the sub-series, so a Discworld
   book files under Discworld rather than under Witches.
3. A `calibre` attachment.

The preference sits with the three that already decide which source's answer a
book shows ([settings](../features/settings.md)) and behaves the same way: on
when absent, instance-wide, no migration owed. It differs from those three in
one respect worth naming — About, Tags and Moods are fetched live and never
stored, while series is **stored**, because sorting and grouping the shelf by
series cannot wait on a per-book request. So the toggle chooses which stored
attachment wins, not whether to go and ask.

**The `Book` payload keeps `series` and `seriesIndex`.** They are now the
primary attachment's name and position, and every consumer — the shelf, sort and
group, search, OPDS, the command palette — carries on reading a string. A new
`seriesList` alongside them carries every attachment (id, name, slug, position,
primary, source, `booksCount`) for the surfaces that want to show more than one.

**Calibre's mirror rows keep their columns.** `calibre_books` is a verbatim
mirror by [ADR 0011](0011-sync-calibre-into-grimoire-db-and-read-the-library-from-there.md)
and stays one. `books.series` / `books.series_index` also stay, as the
per-member record of what that source said; the tables above are the resolved
answer, derived from them.

## Consequences

- The series strip, series-as-a-filter, and "you have 12 of 41" all become
  queries rather than open questions.
- A book can be in two series without either being a lie, and the shelf still
  shows one.
- Grimoire now stores an answer that can contradict Calibre. It is not written
  back — Calibre stays read-only
  ([ADR 0005](0005-calibre-content-server-as-the-data-source.md)) — so a series
  set here lives in `grimoire.db` and is invisible in Calibre. Where the two
  differ, the panel says which source the shelf is showing.
- Reconcile grows a third thing to keep in step, and the primary is derived
  state that must be recomputed when the preference flips — a settings toggle
  that used to change a render now changes rows.
- Merging or splitting works has to carry attachments with it, which
  [resolving duplicates](../features/resolving-duplicates.md) did not have to
  think about before.
- Folding by name will occasionally fuse two genuinely different series that
  share one. Nothing here splits them back apart yet; the manual attachment is
  the escape hatch until something does.
