---
type: feature
title: Setting a series from Hardcover
description: An action in the details panel that takes a book's series from Hardcover — several, if it has several — and offers to put the rest of that series onto the books you already own.
tags: [frontend, ui, series, hardcover, library]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-16 }
---

# Setting a series from Hardcover

## Summary

**Set series** in the [details panel's](book-details-panel.md) gear menu asks
Hardcover which series the open book belongs to, lets the reader attach one or
more of them, and then — because a series is a group and not a property — shows
every other book in that series that is already on the shelf and offers to
attach them in the same stroke.

## Motivation

Series arrive from Calibre or not at all, and in most libraries it is *not at
all*: a book sideloaded from anywhere but a well-curated store has no series
line, and neither does anything Calibre's metadata download half-answered. The
shelf then scatters a trilogy across three letters of the alphabet.

Hardcover knows. Their catalogue models series as real entities with a position
per book, and [sync](hardcover-sync.md) is already talking to them with the
reader's token — but only for books on that reader's own shelves. A Calibre-only
book, which is most of a library, has no Hardcover side to inherit from
([ADR 0019](../adrs/0019-series-as-records-with-a-primary-per-work.md) explains
where the answer is then stored).

Fixing that one book at a time is the wrong unit of work. Nobody wants to set
"Discworld" on a book; they want their Discworld books to be Discworld books.
Every one of them is the same fact stated once, and the reader has already told
us which series they mean — so asking them to repeat it twelve times is the app
declining to use what it knows.

## Behavior

**The trigger.** **Set series…** in the gear menu
([book actions](book-actions.md)), for every book. It opens a dialog rather than
expanding the panel: this is a decision with a list in it, and the panel is a
read-out. The panel stays open behind the scrim and redraws when the dialog
closes.

It needs the current reader's Hardcover token
([ADR 0012](../adrs/0012-hardcover-as-a-second-source-with-per-reader-tokens.md)).
A reader with no linked account gets the item disabled with a line saying so,
rather than a dialog that can only fail.

### Step one — which series

Hardcover is asked what series the open book is in — by its `hardcover_id` for a
matched book, and by a catalogue search of title and author for a Calibre-only
one, which is the same finder [adding a book](adding-a-book-from-hardcover.md)
uses and lands on the same "is this the right book" question. One row per series:

```
☑  Discworld     this book is #6     41 books · 12 on your shelf     ● primary
☐  Witches       this book is #2      6 books ·  4 on your shelf
```

Rows are checkboxes, not radios — a book genuinely in two series is the case
this feature exists to stop flattening. Exactly one checked row is **primary**,
which is the one the shelf's series line and its sorting will use. Hardcover's
`featured` flag preselects it, the larger `books_count` breaks a tie, and the
reader can move it to any checked row. Unchecking the primary hands the mark to
another rather than leaving the book without one. A series the book is
[already in](hardcover-sync.md) arrives checked, so re-running the action is how
a series catches up rather than a way to lose the others.

**Only the primary is spread across the shelf.** The next step is one series'
roster, because "the rest of the series" is a question about one series — so the
other checked ones are attached to *this book only*, never primary, and the
confirm says so. Spreading a second series is the same action run again with a
different primary.

The counts are the point of this screen. "12 on your shelf" is how the reader
knows what the next step is about to touch before they get there.

Hardcover having no series for the book is an ordinary outcome, not an error:
the dialog says so and offers a name and position to type, which is also how a
series Hardcover does not have gets set at all.

### Step two — the rest of the series

Picking a series and continuing fetches its books and matches them against the
library with the same `fold`/`matchKey` and shared-author tests the
[matcher](book-matching.md) uses. They arrive in three groups:

- **On your shelf — 12.** Checked. Each row reads `#3  Equal Rites → Equal
  Rites (Calibre)`, so a wrong match is visible as a wrong match. A row matched
  on title alone, with no author in common, is checked but flagged — those are
  the ones worth a glance.
- **Already in a series — 2.** Unchecked, showing what would be replaced:
  `Sourcery  "Discworld Novels" #5 → Discworld #5`. Overwriting somebody's
  existing answer is never the default.
- **Not on your shelf — 27.** Collapsed and inert, there to make the number
  make sense. Adding them is [another feature](adding-a-book-from-hardcover.md)
  and not offered here.

Every row is a checkbox, so any single bad match can be dropped without
abandoning the run.

**Confirming.** The primary button carries the count — **Set series on 13
books** — and a confirm step states it in words before anything is written.
There is no undo: the confirmation is the guard, the run is idempotent, and
re-running the action re-states the same series rather than compounding it. The
one thing worth being sure about is the replacements, so the confirm names them
separately: *"2 books already have a different series; their series will be
replaced."*

**What gets written.** A `manual` attachment per book
([ADR 0019](../adrs/0019-series-as-records-with-a-primary-per-work.md)) — a
decision a person made, which reconcile leaves alone on every later sync. One
apply per series: the primary carrying every book the reader confirmed, then one
each for the other checked series carrying the open book alone.

The book the dialog was opened from is in the apply whether or not the roster
found it — a series can hold a book the matcher missed, and the reader was
looking at that book when they said yes. The exception is a book the roster
*did* offer and the reader unchecked: that is an answer, and re-adding it would
override the one row they were looking straight at.

**Running it again** is how a series that gained a book catches up. The dialog
opens on the series already attached, the roster comes back with the new entry
in **On your shelf** and the twelve already-set rows checked and unchanged, and
confirming rewrites what was already true.

### After it lands

The panel's series line becomes chips, primary first, each carrying its position
and — where the attachment came from Hardcover or a run of this action — their
mark, so it is clear the shelf is showing something Calibre does not have.

The shelf behind redraws: 13 books change their series line, and if the shelf is
grouped or sorted by series they move. That is a bigger visible change than any
action so far, which is the reason for the count on the button and the confirm
behind it.

### Where the series comes from without asking

Independently of this action, [Hardcover sync](hardcover-sync.md) pulls the
series of every book on a linked reader's shelves and attaches them with source
`hardcover`. A fourth switch in [settings](settings.md) — **Series**, beside
About, Tags and Moods, on by default — decides whether those beat Calibre's when
both have an answer. Turning it off does not delete anything: it re-decides which
attachment is primary, and Calibre's series line comes back.

This action exists for what that cannot reach: the Calibre-only books, which is
most of the shelf.

## Acceptance criteria

- [x] The gear menu offers **Set series…** for every book, disabled with a
      reason for a reader with no linked Hardcover account.
- [x] The dialog lists every series Hardcover has for the book, each with the
      book's position, the series' size, and how many of it are on the shelf.
- [x] More than one series can be attached, exactly one is primary, and the
      primary is what the shelf's series line and sorting use.
- [x] A book Hardcover has no series for offers a typed name and position
      instead of an error.
- [x] Continuing shows the series' books split into on-the-shelf, already-in-a-
      series, and not-owned, with the first group checked and the second not.
- [x] A match made on title alone is flagged as such.
- [x] The primary button states how many books will change, and a confirm step
      names the replacements separately before anything is written.
- [x] Applying writes `manual` attachments that survive a Calibre sync and a
      Hardcover sync.
- [x] Re-running the action on the same series changes nothing and does not
      duplicate an attachment.
- [x] The panel and the shelf behind it show the new series without a reload.
- [x] With the **Series** switch on, a synced Hardcover series wins over
      Calibre's; with it off, Calibre's shows and nothing is lost.
- [x] The dialog has Storybook stories covering: several series, none, a roster
      with conflicts, and a reader with no token.

## API

`GET /api/books/:bookId/hardcover/series` is reader-scoped and answers with the
series Hardcover has for the open book — id, name, slug, `booksCount`, this
book's position, and `featured` — plus Grimoire's own id for each, how many
works are already in it, and whether this book is one of them. Their featured
series comes first, then the largest, so the row the dialog preselects is the
top one. A book Hardcover has no side of answers `hardcoverBookId: null` and no
series, which is the dialog's cue to offer the finder;
`?hardcoverBookId=` names the catalogue book explicitly once the reader has
picked one out of it.

`GET /api/hardcover/series/:hardcoverId/roster` answers with the series' books
in position order, each already matched against the library server-side: the
Hardcover title, authors and position, the work it matched (if any), whether the
match agreed on an author or only on the title, and that work's current series
where applying would replace it. Matching happens on the server because that is
where the matcher and the library live, and it is deliberately looser than the
[automatic pass](book-matching.md) — nothing is written, and a person reads
every row. 409 for a reader with no linked account: unlike the read-outs, this
was asked for by somebody who pressed something.

`POST /api/series/apply` takes the series — by Hardcover id *and* name, since
the row may not exist here yet — and the whole list of `{ workId, position }`
the reader agreed to. It writes `manual` attachments, optionally making the
series primary on each work, and answers with those books as they now are. 404
naming the first work that does not exist; re-applying the same series to the
same works changes nothing.

All three carry shared Zod schemas
([ADR 0009](../adrs/0009-zod-schemas-shared-between-api-and-client.md)).

## Open questions

- **Adding the ones you don't own.** The 27 not on the shelf are exactly the
  list a "complete the series" feature would want, and this dialog is where a
  reader will look for it.
- **The series strip.** With series stored as records the panel can finally show
  the whole series with the owned ones filled in
  ([book details panel](book-details-panel.md)) — a separate feature, unblocked
  by this one.
- **Series as a filter.** Same unblocking, same separate decision
  ([library source filter](library-source-filter.md) is the shape it would take).
- **Removing a series.** The dialog attaches and replaces; nothing detaches a
  work from a series yet.
- **Bulk from a selection.** This writes to thirteen books from one book's
  panel, which is the first bulk write in the app and deliberately not a
  selection model ([book actions](book-actions.md)). Whether the shelf ever
  grows one is still open.
