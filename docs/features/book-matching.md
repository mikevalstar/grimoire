---
type: feature
title: Book matching
description: The automatic pass that decides two book rows from different sources are the same book and groups them under one work. Narrow on purpose, and it leaves alone anything it isn't sure about.
tags: [sync, data, matching, calibre, hardcover]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-14 }
---

# Book matching

## Summary

After every sync, Grimoire looks for book rows from different sources that are
obviously the same book, and puts them in one work
([ADR 0013](../adrs/0013-group-duplicate-books-into-works.md)). A book you own
in Calibre and track on hardcover.app becomes one card on the shelf carrying
both marks, with one set of stars.

"Obviously" is doing real work in that sentence. This pass is built to be
narrow. A duplicate it misses is a cosmetic annoyance. Two different books it
wrongly declares identical corrupts a reader's library.

## Motivation

[Hardcover sync](hardcover-sync.md) brought a second source in without matching,
which was the right way to get real data to design against and the wrong thing
to leave in place. Two rows per book is visible on every screen and quietly
wrong underneath: ratings hang off the row, so the same book has two.

## Behavior

### Normalising a title

Matching on raw titles fails on punctuation and pleases nobody. Every title is
reduced to a match key first:

- Unicode-normalised and stripped of diacritics, so `Solaris` and `Solāris` meet.
- Lowercased.
- `&` becomes `and`.
- Bracketed suffixes go, `(The Expanse #3)` and `[Illustrated]` alike, because
  one source routinely carries the series in the title and the other does not.
- Edition noise goes: `second edition`, `2nd ed`, `revised edition`,
  `unabridged`, `illustrated`.
- A leading article goes: `the`, `a`, `an`.
- Punctuation becomes spaces, and runs of whitespace collapse.

`The Blade Itself (The First Law #1)` and `Blade Itself, The` both become
`blade itself`. The key is stored on the row and indexed, so finding candidates
is a grouped query rather than comparing every book with every other one.

### Deciding

Two rows are the same book when their match keys are equal and they share at
least one author surname.

The author check is a verification, not part of the key. Putting authors *in*
the key looks tidier and is brittle: Hardcover's contributor list includes
narrators and illustrators, the two sources order multiple authors differently,
and one of them writes `Corey, James S.A.` The check is set intersection over
surnames, normalised the same way as titles. That tolerates all of it while
still refusing to merge two unrelated books that happen to share a title.

A title alone is never enough. `Persuasion` is a book by Jane Austen and a book
by Robert Cialdini.

### Merging

The oldest work in a cluster survives and the others' rows move into it. The
survivor is picked that way because it is the one a reader's stars are most
likely already on. That is a preference, not a safeguard. The matcher carries
everything held about a losing work onto the survivor before deleting it, since
ratings, read states, series attachments and the chosen cover all hang off
`works.id` and cascade with it.

Where both works hold an answer from the same reader, the survivor's stands.
Stars are the exception, where the higher of the two wins, matching the rule in
[ADR 0013](../adrs/0013-group-duplicate-books-into-works.md)'s migration set.
The matcher carries only `manual` series attachments. The next reconcile sweep
re-derives a `calibre` or `hardcover` one from the rows that just moved, and
never re-derives a manual one. A person merging two works by hand runs the same
operation under the same rules. See
[resolving duplicates](resolving-duplicates.md).

### What it refuses to do

- **Never groups two rows from the same source.** Two Calibre rows with one
  title and author are two editions, an accident, or a re-import. That is a
  question for a person, not something to answer by merging. The work is left
  alone and the collision is a conflict for the manual pass.
- **Never touches a pinned book.** `books.work_pinned` marks a grouping a human
  decided; the matcher skips those rows entirely, so a manual fix survives every
  later sync. [Resolving duplicates](resolving-duplicates.md) is what sets it.
- **Never groups a pair somebody has ruled out.** A "not the same book" answer
  is a row in `book_not_duplicates`, and this pass honours it. Otherwise the
  answer would last only until the next sync.
- **Never splits a work.** Un-grouping is a decision to reverse a decision, and
  doing that automatically means a re-sync that changes a title quietly tears a
  book in half. Splitting is manual. See
  [resolving duplicates](resolving-duplicates.md).
- **Never matches a book with no authors on either side.** That is a candidate,
  not a match.

### When it runs

Three moments, and the first is the one that matters for a library that already
exists:

- **At startup**, before either syncer. A library that predates works, or one
  that simply has not changed since, is grouped on the next launch rather than
  waiting for a book to be edited.
- **At the end of every sync** that inserted or updated anything, Calibre's and
  Hardcover's alike.
- **On demand**, from `POST /api/match` and the **Find duplicates** button in
  [settings](settings.md), which reports what it grouped and, more usefully,
  what it left alone.

Each pass is one indexed grouped query and a handful of updates over the whole
library, so there is nothing to gain from being clever about which rows changed.
Running it twice groups nothing the second time: books already sharing a work
are already grouped, and everything else was already refused.

Grimoire writes a book's match key whenever it reconciles the row, and backfills
it on first open for every row that predates the column. Otherwise nothing
already in the database would have anything to match on.

### What it does not do yet

No identifiers. ISBNs, Goodreads ids and ASINs are the precise tier this pass is
missing, and Grimoire currently holds none from Hardcover. Their depth-3 query
limit puts `user_books { book { editions { isbn_13 } } }` one level out of
reach, so [the sweep](hardcover-sync.md) never asked for them. Fetching them
needs a second query keyed by the book ids already mirrored, and until that
exists this pass is title-and-author only.

Worth knowing when it lands: an ISBN identifies an edition, not a work. Your
Calibre EPUB and your Hardcover entry can carry different ISBNs for the same
book, so identifiers buy precision, not recall. They are a tier above this one,
not a replacement for it.

## Data model

Two columns on `books`, and the `works` table from
[ADR 0013](../adrs/0013-group-duplicate-books-into-works.md):

```sql
match_key   TEXT,                      -- the normalised title; NULL when there is no title to normalise
work_pinned INTEGER NOT NULL DEFAULT 0 -- a human decided this grouping; the matcher skips it
```

The same function writes `match_key` on both reconcile paths, so the two sources
can never disagree about how a title normalises. It is indexed, and it is the
only reason this pass does not read like a cross join.

## API

`POST /api/match` runs a pass and answers with what it did: `grouped`, and
`conflicts` for the groups it refused. Every payload has a schema shared by API
and client ([ADR 0009](../adrs/0009-zod-schemas-shared-between-api-and-client.md)).

## Acceptance criteria

- [x] A book in both Calibre and Hardcover with the same title and author
      becomes one card carrying both marks.
- [x] Its rating is one rating, and survives the grouping happening after it was
      set, on either of the works involved, not only the one that survives.
- [x] A read state, a manual series attachment and a chosen cover on the losing
      work survive the grouping too.
- [x] Where both works carry an answer from one reader, the higher rating wins
      and the surviving work's read state stands.
- [x] Titles differing only by case, punctuation, diacritics, a leading or
      trailing article, a bracketed series suffix or an edition suffix still
      match, and `Corey, James S.A.` is the same author as `James S.A. Corey`.
- [x] Two books sharing a title but no author do not match.
- [x] Two rows from the same source never end up in one work.
- [x] A pinned book is never regrouped by a later sync.
- [x] Running the matcher twice groups nothing new the second time.
- [x] Every book has exactly one work, always, including books nothing matched.
- [x] A database written before works existed gains them on open, and every
      rating in it survives, re-keyed onto the work of the book it pointed at.
- [x] A library that already held both halves of a book, with no sync running
      and nothing changed, is grouped by the next launch.

## Open questions

- **No candidate queue.** Near misses are still discarded rather than recorded.
  [Resolving duplicates](resolving-duplicates.md) recomputes them per book when
  a panel asks, which is enough for one book at a time and not enough for a
  library-wide review screen.
- **No record of why.** A work does not say which rule grouped it. That belongs
  in the decision log that manual resolution needs anyway.
- **Fuzzy matching is absent.** Title distance, year and page proximity would
  raise recall well past exact key equality. Every one of them needs a
  threshold, and a threshold needs the queue above to tune against.
- **A changed title leaves an old grouping standing.** Nothing splits
  automatically. Correct, and it means the shelf can hold a group that no longer
  matches on today's data.
- **Series and omnibus editions are unhandled.** A collection sharing its name
  with its first book is exactly the false positive this design fears, and only
  the same-source rule protects against it today.
