---
type: feature
title: Marking a book read
description: A dog-eared corner on every cover — a check in a cut-off triangle, bottom right — marking a book read or unread through a confirm that asks when it was finished and, optionally, what it deserved. Stored locally, or on the reader's Hardcover shelves.
tags: [frontend, ui, library, users, ratings, hardcover]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-15 }
---

# Marking a book read

## Summary

Every cover's bottom-right corner is a dog-ear: a cut-off triangle holding a
check. Read books wear it filled; unread books reveal it on hover, like the
stars. Clicking always confirms through a modal — marking read asks when it
was finished and offers a rating; unmarking asks whether the rating should go
too. Where the answer lives follows the reader's read-state source: their
Hardcover shelves, or Grimoire's own database.

## Motivation

Read state is the second per-reader fact about a book, after
[the rating](rating-a-book.md), and the two keep leaning on each other:
rating a book already implies reading it, and the Hardcover flows built for
ratings keep having to answer "when did you finish it?" on the side. Making
read state first-class gives that question a home of its own — and gives a
reader who never linked Hardcover a way to track reading at all.

## Behavior

### The corner

On each card in the [book list](book-list.md)'s cover view, bottom right of
the cover: a triangle cut, carrying a check. A read book's corner is filled in
the reader accent and always visible. An unread book's corner is revealed on
hover or focus — same rule as the stars: nothing on hover a keyboard can't
reach, nothing moving under a click.

### Where it lives

Each reader has a **read-state source**, beside their rating source in the
settings Hardcover card ([settings](settings.md),
[ADR 0014](../adrs/0014-per-reader-rating-source-with-hardcover-write-back.md)
established the pattern):

- **Local** — a `read_states` row per (reader, work) in `grimoire.db`, holding
  the finished-when at whatever precision the reader gave ("2023", "2023-06",
  "2023-06-15", or nothing). Unread is the absence of a row, like an unrated
  book. This is the only choice for a reader with no Hardcover account.
- **Hardcover** (the default for a linked reader) — read means status **Read**
  on their shelves, and the finished-when lands on the read entry the way the
  rating flows already do.

### Marking read

Always through the modal — never a bare toggle:

- The finished-when question, exactly as in [rating](rating-a-book.md):
  I don't know (default), today, a date, a month or year. Never earlier than
  the year before publication, and never later than today.
- An optional rating — skippable stars, offered only when the reader's rating
  source matches their read-state source, so a rating can never land in the
  other store as a side effect.
- On Hardcover, a book not on their shelves is added as Read (the modal says
  so); a Calibre-only book opens the same finder rating one does, with
  **Add as read** in place of the rating button.

### Unmarking

Also always through the modal. Locally the row is deleted. On Hardcover the
book has to hold *some* status, so unmarking sets it back to
**Want to Read** — the modal says so. Where the book carries a rating (and
sources match), the modal asks whether to remove it too: **Keep the rating**
or **Remove it as well**; a book with no rating just confirms.

## Acceptance criteria

- [ ] Read books show a filled corner check; unread covers reveal one on
      hover/focus, keyboard reachable, without shifting the card.
- [ ] Marking read always opens the modal: finished-when, optional stars
      (matching sources only), and lands in the reader's read-state source.
- [ ] Unmarking always opens the modal; on Hardcover it says the book goes
      back to Want to Read; with a rating present it asks keep-or-remove.
- [ ] A reader with no Hardcover account can mark books read and unread, with
      dates, entirely locally — and it survives a reload.
- [ ] In Hardcover mode a Calibre-only book routes through the finder with
      "Add as read".
- [ ] The read-state toggle in settings is real: stored per reader, applied
      immediately, only shown on linked cards.
- [ ] The corner and both modal states have Storybook stories.
- [x] The library toolbar can filter the current reader's shelf to All, To
      read, or Read books without refetching.
- [x] A read book's details panel shows its known finish dates; Hardcover
      rereads are fetched live when the panel opens rather than mirrored.

## Open questions

- Unmarking on Hardcover leaves the read entry's dates alone — deleting their
  `user_book_read` records felt like erasing history that isn't ours. Revisit
  if a re-mark produces doubled reads.
- The corner lives on the cover grid only. The table view and details panel
  want their own affordance, probably a column and a button.
- Local read states and Hardcover shelves don't sync into each other on a
  source switch; like ratings, each source is its own truth.
