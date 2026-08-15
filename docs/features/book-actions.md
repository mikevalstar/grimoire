---
type: feature
title: Book actions
description: A gear menu in the details panel holding the deliberate, per-book operations — starting with re-fetching a book's cover from every source it has.
tags: [frontend, ui, library, covers]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-15 }
---

# Book actions

## Summary

The [details panel](book-details-panel.md) footer carries a gear button,
labelled **Actions**, opening a menu of operations that act on the open book.
The first one is **Re-fetch cover**: download every member's cover again, from
Calibre and from [Hardcover](hardcover-sync.md), and overwrite what is cached on
disk.

## Motivation

Everything the panel offered until now was either a read-out or a per-reader
opinion (a rating, a read date). The things a reader occasionally needs to *do*
to one book — re-fetch its cover today, and later re-match it, forget it, or
push a correction — have had nowhere to live, and each one cannot become its own
button in the footer without the footer becoming a toolbar.

A menu behind a gear is the cheap answer: one affordance, quiet enough to ignore,
and it holds the next five actions without a redesign.

Re-fetching a cover is the first because the cover is the one piece of a book
Grimoire caches as a *file*. [Sync](calibre-sync.md) only fetches it again when
Calibre says the book was edited — so a cover replaced in Calibre with the same
timestamp, an image that arrived truncated, or one downloaded while
[Hardcover's](hardcover-sync.md) CDN was misbehaving stays wrong indefinitely.
The remedy so far has been a full sync of the whole library, which is a large
hammer for one book.

## Behavior

**The trigger.** A gear at the right end of the panel's footer row, opposite
[Link a duplicate](resolving-duplicates.md), with an *Actions* tooltip and the
same accessible name. It is there for every book, including one that has left the
Calibre library — the actions each decide for themselves what they can do.

**Re-fetch cover** takes every member row of the work
([ADR 0013](../adrs/0013-group-duplicate-books-into-works.md)) and fetches
whatever that member's source can hand over: the Calibre content server for a
member still in the library, the stored CDN URL for a Hardcover one. Each success
overwrites all three cached sizes for that member; a member whose fetch fails
keeps the file it already had rather than losing it. This is the one cover path
that ignores every "we already have it" test — that is the whole point of asking
for it by hand.

It is offered for every book rather than hidden for one with nothing to ask:
which members have a source is server-side knowledge, and a run that found
nowhere to look says so in the same place a run that failed does.

While it runs the item shows a spinner and the menu stays open; the panel is
otherwise untouched, so the rest of the book stays readable. When it lands, the
open panel and the shelf behind it redraw with the new image — including the
[cover stack](book-details-panel.md) if the work has more than one. A run where
nothing could be fetched says so in the menu rather than silently doing nothing.

**Cache-busting is why the book carries a cover version.** Covers are served with
a year-long `max-age`, so re-fetching a file behind an unchanged URL would show
the reader the old image until the cache expired. The book record now carries
`coverVersion` — the newest `cover_synced_at` among its cached members — and
every cover URL stamps it, alongside the `member` that
[choosing a cover](book-details-panel.md) already stamped.

**It is not a re-sync.** No metadata is touched, no other book is looked at, and
the sync schedule is not disturbed.

## Acceptance criteria

- [x] Every open book's panel shows the gear, with an *Actions* tooltip and
      accessible name, at the right of the footer row.
- [x] Re-fetch cover downloads and overwrites the cached covers of every member
      of the work, from Calibre and Hardcover both, regardless of what sync
      believes about them.
- [x] The new image appears in the panel and on the shelf without a reload.
- [x] A member whose fetch fails keeps its existing cover, and the action reports
      that nothing was fetched.
- [x] A book with no member that has a source to ask reports that it found
      nothing, rather than appearing to succeed.
- [x] The gear and its menu appear in the panel's Storybook stories.

## API

`POST /api/books/:id/cover/refetch` re-fetches the covers of every member of the
work and answers with `{ book, attempted, fetched }` — the book as it now is
(carrying the bumped `coverVersion`), how many members had a source to try, and
how many produced a file. 404 for a work that does not exist. The payload is a
shared Zod schema
([ADR 0009](../adrs/0009-zod-schemas-shared-between-api-and-client.md)).

`GET /api/books` carries `coverVersion` on every book, and
`GET /api/books/:id/cover/:size` accepts (and ignores) a `v` query parameter —
it exists to make the URL change, and the file on disk is the answer either way.

## Open questions

- **Other actions.** Re-match against Hardcover, forget a book that has left
  Calibre, and copying an identifier are the obvious next entries; none is
  decided yet.
- **Uploading a cover** would be the natural neighbour of re-fetching one, and
  waits on the same thing the panel's open questions record: a `grimoire` member
  row to hold it.
- **Failure detail.** The action reports how many covers it got, not which source
  refused. A book with two members where one fails looks like a partial success
  with no way to see which half.
- **Bulk.** No way to re-fetch the covers of a selection, or of everything a
  filter matches — the shelf has no selection model yet.
