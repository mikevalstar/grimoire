---
type: feature
title: Resolving duplicates
description: The details panel tells a reader when a book looks like a duplicate of another, and gives them one click to say it is — or that it isn't, permanently.
tags: [frontend, ui, matching, data, library]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-14 }
---

# Resolving duplicates

## Summary

The [details panel](book-details-panel.md) shows, under the book it is about,
the entries that look like the same book — the near misses
[matching](book-matching.md) is built to refuse. Each one offers two answers:
**Same book**, which puts them in one work, and **Not the same**, which is
remembered so neither the suggestion nor the matcher raises it again.

When nothing is suggested — which is most books — **Link a duplicate** searches
the shelf and joins whatever the reader picks. A work with more than one entry
lists them, and any of them can be separated back out, so nothing here is a
one-way door.

## Motivation

[Matching](book-matching.md) is narrow on purpose, and the things it refuses are
exactly the ones a person has to decide: two rows from one source, a title one
source subtitles and the other doesn't, a book whose authors don't line up. Until
now it discarded them. `books.work_pinned` was added for the manual pass and
nothing wrote it.

The harder half of the problem is not picking the duplicate but *knowing there is
one*. Nothing told a reader; they found out by scrolling past the same cover
twice. So the panel volunteers it, and picking is a click rather than a search —
searching the library for a book you are already looking at is work the app can
do itself.

## Behavior

### Finding candidates

Candidates are computed on demand for one work, from the same
[match keys](book-matching.md) the automatic pass uses, and every rule that pass
enforces is relaxed to a *label* here — a human is reading the result, so the
cost of a wrong suggestion is a glance rather than a corrupted library.

Three ways a candidate is found, and the panel says which:

- **Same title and author** — the pair the matcher would have grouped had they
  not come from one source. This is the common case: two Calibre rows.
- **Same title, different author** — the author check that keeps
  `Persuasion` from meeting `Persuasion` still holds for the matcher; here it
  becomes a caveat printed under the title.
- **Same author, longer title** — one match key extends the other at a word
  boundary, which is the subtitle divergence exact matching cannot see. An
  author in common is required for this one, since a title prefix alone would
  suggest every book in a series to every other.

Nothing else is a candidate. No fuzzy distance, no year proximity — both need a
threshold, and a threshold needs the tuning data
[matching](book-matching.md) still doesn't collect.

Candidates are rolled up per work, best reason first, and capped — a panel is
not a report.

### Linking one yourself

Suggestions only cover what the [match keys](book-matching.md) can see. A book
whose two entries are titled differently enough — a translation, a boxed set, a
title someone retyped — is never offered, and until it is offered there is
nothing to click. So the panel also takes a **Link a duplicate** action, at the
bottom, below everything the book itself has to say: the suggestions are
information and sit high, this is a deliberate act and sits where you go looking
for it.

It replaces the panel's body rather than opening a dialog over it — a modal on a
modal, with the book you are joining *from* hidden behind it, is the wrong shape
for a comparison. The header stays, the body becomes a search, and a back arrow
returns.

The search is **the shelf's own list, filtered in the browser**: the client
already holds every work ([`fetchBooks`](../../apps/web/src/lib/api.ts)), so
there is no endpoint and no round trip. It is seeded with the open book's title,
which means the thing being looked for is usually already on screen — the
suggestion flow, arrived at the long way round.

Titles are matched the way the matcher matches them, through the same
[`matchKey`](../../packages/core/src/matching.ts), so `Blade Itself, The` finds
`The Blade Itself`; authors are searched too, since half of finding the other
copy is remembering who wrote it. Results carry a cover, the source marks and
how many entries the work already has — joining a two-entry work to another
two-entry work is a bigger act than it looks, and the row should say so.

The open book is not in its own results, and nothing else is excluded: a manual
join can put two Calibre rows together, or two books that only a reader can see
are the same. That is the point of it being manual. Every join is the same
operation as saying **Same book**, and **Separate** undoes it.

### The review queue

The same candidates, library-wide, in the [settings](settings.md) Duplicates
section: every pair the automatic pass refused and a person hasn't answered
yet, found by running the panel's per-work query across the whole shelf and
deduplicating pairs seen from both sides. Each row shows the two books —
cover, title, authors, source marks — the reason they're suspected, and the
same two answers the panel offers: **Same book** and **Not the same**.
Answering removes the row; the queue caps what it shows and says when it has
(a settings pane is not a report). This is the queue the **Find duplicates**
button's conflict count was always pointing at.

### Saying yes

**Same book** joins the two works. It is the same operation the matcher performs
and obeys the same rules ([ADR 0013](../adrs/0013-group-duplicate-books-into-works.md)):
no row is merged away or deleted, the **older** work survives so a rating stays
where it was, and the members of the other work move into it. A rating on the
work that loses is carried across rather than cascaded away; where both were
rated, the higher stands, matching the rule the ADR 0013 migration already set.

Every member of the result is **pinned**. A grouping a person made is not the
matcher's to reconsider, and pinning is how that survives the next sync.

The panel follows the merged work, so the book stays open under the reader with
one more entry listed on it.

### Saying no

**Not the same** records the answer against `books` rows rather than works,
because a row is the stable thing — a work is exactly the grouping being argued
about. The record is honoured in both directions: the suggestion is gone, and
the automatic matcher will not group those rows even when they share a title and
an author.

It records **every pair across the two works**, not just the two rows the
suggestion was found through. A work is one book, so if this book isn't that
one, no member of either is — and recording less would let the same question
come back through a sibling row, or let the matcher merge the two works through
one.

That last part is the negative edge
[ADR 0013](../adrs/0013-group-duplicate-books-into-works.md) anticipated. Without
it "not the same" would survive exactly until the next sync, which is not an
answer.

### Separating

A work showing more than one entry lists them all with their sources. **Separate**
moves one back into a work of its own, pins what's left, and records it as not a
duplicate of each remaining member — so it neither re-merges nor comes back as a
suggestion.

This is the undo for a merge, and the fix for one the matcher got wrong. Its
ratings stay with the work the reader was looking at rather than following the
row out; stars are a verdict on the book, and the book is the work.

### Where it sits

In the panel, below the download and above the details — high enough to be seen
while reading the book's own metadata, and absent entirely for a book with one
entry and no candidates, which is nearly all of them. The section never renders
a skeleton: a suggestion arriving a moment late is fine, a placeholder on every
book is not.

## Data model

One table, and the pinning column [matching](book-matching.md) already added:

```sql
CREATE TABLE book_not_duplicates (
  book_id       INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  other_book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL,
  PRIMARY KEY (book_id, other_book_id),
  CHECK (book_id < other_book_id)
)
```

Pairs are stored with the lower id first, so one row states the fact once and a
lookup never has to try it both ways round.

There is deliberately **no candidates table**. A suggestion is derived from data
that already exists and is cheap to recompute against an index; storing it would
add a thing that can be stale. Only the *decisions* are stored.

## API

All three speak work ids, like every other book route
([ADR 0013](../adrs/0013-group-duplicate-books-into-works.md)), and every payload
has a shared schema
([ADR 0009](../adrs/0009-zod-schemas-shared-between-api-and-client.md)) in
[schemas.ts](../../packages/core/src/schemas.ts):

- `GET /api/books/:id/duplicates` — this work's members, and its candidates.
  A candidate names the *other work* and the pair of rows it was found from;
  it does not repeat the book's metadata, because the client already holds
  every work ([`fetchBooks`](../../apps/web/src/lib/api.ts) returns the whole
  library) and looking it up there keeps the two in step.
- `POST /api/books/:id/duplicates` — `{ workId }`. Same book. Answers with the
  merged work. A manual join is this same call with a work the reader picked
  rather than one that was suggested; there is no separate route for it, and
  the server does not distinguish the two.
- `POST /api/books/:id/duplicates/dismiss` — `{ bookId, otherBookId }`. Not the
  same. Answers with the refreshed list.
- `POST /api/books/:id/separate` — `{ bookId }`. Answers with the work as it
  now is.

## Acceptance criteria

- [x] A book whose title and author match another entry shows it as a candidate
      in the panel, with the reason named.
- [x] Two rows from the same source — which the matcher refuses — are offered
      here.
- [x] A title that extends another at a word boundary is offered when the
      authors overlap, and not when they don't.
- [x] A book with no candidates and one entry shows no section at all.
- [x] **Same book** merges the works, keeps the older one, and the panel stays
      open on the result.
- [x] A rating on either work survives the merge; where both were rated, the
      higher stands.
- [x] Merging pins every member, and a later sync does not undo it.
- [x] **Not the same** removes the candidate, survives a reload, and the
      automatic matcher never groups that pair afterwards.
- [x] A work with two entries lists both with their sources, and **Separate**
      puts one back on its own.
- [x] A separated book does not re-merge on the next sync and is not suggested
      again.
- [x] The shelf behind the panel reflects a merge or a separation without a
      reload.
- [x] The section has Storybook stories, in both themes.
- [x] Every book's panel offers **Link a duplicate**, including one with no
      entries to list and nothing suggested.
- [x] It replaces the panel body, keeps the book's own header, and the back
      arrow returns without joining anything.
- [x] The search opens seeded with the book's title, and matches titles the way
      the matcher does — `Blade Itself, The` finds `The Blade Itself`.
- [x] Searching an author's name finds their books.
- [x] The open book never appears in its own results.
- [x] A result shows its cover, sources and entry count.
- [x] Picking one joins the works, closes the search, and leaves the panel on
      the merged book with both entries listed.
- [x] A join that fails says so and leaves the search open.
- [x] The picker has Storybook stories, in both themes.

## Open questions

- **The picker's search is the shelf's missing one.** [The toolbar](book-list.md)
  still holds a placeholder where filtering will go, and when it arrives the two
  should be the same input over the same ranking rather than two things that
  nearly agree.
- **No primary entry.** Which member's metadata wins is still source
  precedence ([ADR 0013](../adrs/0013-group-duplicate-books-into-works.md)):
  Calibre first, the rest filling gaps. Choosing per work — the way a
  [cover](book-details-panel.md) already can be chosen — is the obvious next
  step and needs a column of its own.
- **No identifiers.** ISBNs would make the top tier precise rather than
  probable, and Grimoire holds none from Hardcover yet
  ([matching](book-matching.md) says why).
- **Dismissals are invisible once made.** There is no list of "things I said
  weren't duplicates", so an answer given by accident can only be undone by
  saying **Same book** — which works, but is not the same as changing your mind
  about the question.
- **Nothing merges across a rename.** A candidate is only ever offered while the
  two titles still relate; editing one in Calibre first makes the suggestion
  disappear.
