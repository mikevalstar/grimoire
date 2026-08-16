---
type: feature
title: Adding a book from Hardcover
description: A plus beside the header search that finds any book in Hardcover's catalogue, shelves it for the current reader, and drops it into the library — optionally already read, on a date.
tags: [frontend, ui, library, hardcover, api]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-16 }
---

# Adding a book from Hardcover

## Summary

A **+** button beside the [header](application-shell.md) search trigger — and a
matching [command palette](command-palette.md) entry — opens a dialog that
searches [Hardcover's](hardcover-connection.md) catalogue, shelves the picked
book for the current reader, and lands it in the library as a Hardcover-sourced
book. The reader chooses which shelf (**Want to read**, **Reading**, **Read**)
and, when it's Read, optionally when they finished it.

Shown only for a reader with a linked Hardcover account: without a token there
is nowhere to add anything to.

## Motivation

Grimoire's library is everything Calibre holds plus everything on a reader's
[Hardcover shelves](hardcover-sync.md). Until now the second half was strictly
read-only in this direction: books arrived by syncing shelves the reader had
built on hardcover.app. A book they read but never owned — a library loan, a
paperback, an audiobook — could only enter Grimoire by leaving Grimoire.

Every piece needed already exists for
[rating a Calibre-only book](rating-a-book.md): a catalogue search, a shelve
write, a read-date picker, and the reconcile that turns a mirrored shelf entry
into a library book. This wires them to a book that has no Calibre side at all,
which is the one case the finder can't reach — it starts from a book you already
have.

## Behavior

**The trigger.** A **+** sits immediately after the header's search trigger, in
both its wide and narrow forms, and reads "Add a book from Hardcover". It is
absent for a reader with no linked account, and absent before a reader is
chosen. The palette carries the same action under Library, so it is reachable
from the keyboard alone.

**Finding it.** The dialog opens on an empty search over Hardcover's whole
catalogue — this is the one search in the app not seeded from a book, because
there is no book yet. Typing searches after a pause; results are covers, title,
authors and year, exactly as the [finder](rating-a-book.md) draws them, and
picking one selects it. Both use the same search component and the same
reader-scoped route, so a token problem reads the same way in both.

**Which shelf.** Once a book is picked, three chips: **Want to read**,
**Reading**, **Read** — defaulting to Read, which is what someone reaching for
this is usually recording. Choosing Read reveals the same
[read-date picker](marking-a-book-read.md) used everywhere a book becomes read,
bounded below by the picked edition's release year; the other two shelves hide
it, because an unfinished book has no finish date. The confirm button names the
shelf the click will write.

**What lands.** The book is inserted on the reader's Hardcover shelves at the
chosen status, mirrored, and reconciled into the library the same way a synced
shelf entry is — so it appears as a Hardcover-sourced book, with Hardcover's
cover and Hardcover's marks, and counts toward the
[source filter](library-source-filter.md). A background sweep follows for the
authoritative row and the cached cover. When the new book's work id comes back,
its [details panel](book-details-panel.md) opens: the answer to "did that work?"
is the book itself.

**A book already there.** Nothing stops a reader picking a book they already
have — Hardcover accepts the shelving, and the mirror updates the entry rather
than duplicating it. If Grimoire also holds a Calibre copy, the pair is left to
[matching](book-matching.md) and, failing that, the
[duplicates queue](resolving-duplicates.md), like every other pairing nobody
pinned by hand.

**When it fails.** Hardcover's refusal is shown in the dialog and the dialog
stays open with the pick intact — the same contract the finder has. A write that
succeeded but whose read replica lagged still adds the book; the library just
learns about it on the following sweep instead of immediately.

## API

`POST /api/users/:id/hardcover/books` — shelve a catalogue book for that reader.

Body: the Hardcover book id, a status id (1, 2 or 3), and an optional
`finishedAt` at whatever precision the reader knows. Answers the new work's
Grimoire book id, or `null` when Hardcover accepted the write but wouldn't yet
answer with the entry. Reader-scoped by path like the catalogue search beside
it, and 400s for a reader with no linked account.

It shares its shelving with the rating and read-state routes (see
[ADR 0014](../adrs/0014-per-reader-rating-source-with-hardcover-write-back.md));
the only thing unique here is that there is no existing work to link the result
to.

## Acceptance criteria

- [x] A **+** beside both header search triggers opens the dialog, and is absent
      for a reader with no linked Hardcover account.
- [x] The command palette offers the same action, gated the same way.
- [x] The dialog searches Hardcover's catalogue from an empty query and lets one
      result be picked.
- [x] Shelf chips offer Want to read / Reading / Read, defaulting to Read.
- [x] The read-date picker appears only for Read, and its answer rides the
      shelve write.
- [x] A successful add puts the book on the reader's Hardcover shelves at the
      chosen status and in the Grimoire library as a Hardcover-sourced book.
- [x] The new book's details panel opens when its id is known.
- [x] Hardcover's error is shown in the dialog, which stays open.
- [x] The dialog has a Storybook story, in both themes.

## Open questions

- Whether a reader should be able to add a book to *another* reader's shelves,
  as the settings screen lets them manage other readers' tokens.
- Whether an add should offer a rating in the same breath, the way the
  [read-state modal](marking-a-book-read.md) does — deliberately left out for
  now, since the stars are one click away on the card that lands.
- What this should do when Grimoire eventually owns its own books rather than
  mirroring two sources: the same dialog probably grows a "not on Hardcover
  either" escape hatch.
