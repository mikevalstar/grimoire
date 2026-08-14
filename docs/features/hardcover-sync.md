---
type: feature
title: Hardcover sync
description: Pulls every book on a linked reader's hardcover.app shelves, with its status and rating, into grimoire.db and onto the shelf, where a book already held in Calibre is grouped with it rather than listed twice.
tags: [sync, data, hardcover, users, storage]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-14 }
---

# Hardcover sync

## Summary

For each reader with a [linked Hardcover account](hardcover-connection.md),
Grimoire pulls their whole library — every book they've shelved, with its
status, rating and dates — into its own tables, and folds the books into
`books` so they appear on the shelf.

A book you own in Calibre *and* track on Hardcover is **two rows and one card**:
both rows are kept, and [book matching](book-matching.md) groups them under one
work ([ADR 0013](../adrs/0013-group-duplicate-books-into-works.md)). This sync
does no matching of its own — it writes rows and lets that pass decide what is
the same book.

## Motivation

Matching books across two sources is the hard problem, and it cannot be designed
against a hypothesis. Getting the real data in — real titles, real author
spellings, real identifiers, next to the Calibre rows they will have to be
matched with — turns "how do we match these?" from a thought experiment into a
query.

Reading state is the half Calibre does not have at all. Want-to-read, currently
reading, finished, DNF, and when each of those happened, are things Grimoire has
no way to know today, and they are per reader — which is why the credential is
too ([ADR 0012](../adrs/0012-hardcover-as-a-second-source-with-per-reader-tokens.md)).

## Behavior

### The shape of a sync

Per reader, and only readers who have linked an account:

1. **Mirror** — page through their `user_books` and write both halves verbatim:
   the book into `hardcover_books`, their relationship with it into
   `hardcover_user_books`.
2. **Reconcile** — fold `hardcover_books` into `books`, matched on Hardcover's
   book id.

3. **Covers** — download each book's image and scale it onto disk, the same
   three sizes Calibre's covers are cached at — see [Covers](#covers).

Covers come last for the same reason they do in the
[Calibre sync](calibre-sync.md): cover files are named by the book id that
reconcile assigns.

The same rules the [Calibre sync](calibre-sync.md) works under hold here:
**sync never deletes a `books` row**, one sync at a time per reader, and the
whole reconcile is one transaction.

### What comes across

Everything the shelf might want about the book — title, subtitle, description,
pages, release date, contributors, tags, cover URL — and everything about the
reader's relationship with it: status, their rating, whether they own a copy,
how many times they've read it, and the added / first-read / last-read dates.

Statuses are Hardcover's own numbering, stored as the integer they send:

| id | status |
|----|--------|
| 1 | Want to Read |
| 2 | Currently Reading |
| 3 | Read |
| 4 | Paused |
| 5 | Did Not Finish |
| 6 | Ignored |

The whole `user_books` entry is kept in a `raw` column as well, the same bet
[Calibre sync](calibre-sync.md) makes: their API carries far more than we model,
and keeping the payload means adding a field later is a re-derive rather than a
re-sync of everyone's account.

**Hardcover ratings do not become Grimoire ratings.** They land in the mirror and
stop there. Stars in Grimoire are the reader's own verdict recorded here
([rating a book](rating-a-book.md)); silently importing another service's would
make a book someone never rated in Grimoire look rated. Whether the two should
ever meet is a question for the matching design, which is where a book can
finally have both.

### Talking to their API

One GraphQL query, paged with `limit`/`offset` and `distinct_on: book_id`, run
from the server ([ADR 0012](../adrs/0012-hardcover-as-a-second-source-with-per-reader-tokens.md)).
Three of their limits shape it:

- **Queries are capped at depth 3**, so the nested `contributions { author {
  name } }` their examples use is out of reach. The book's cached JSON columns —
  contributors, image, tags — carry the same information one level shallower,
  and are what the mirror reads.
- **60 requests a minute.** Pages are paced so a large library cannot spend the
  budget, and a paged sweep stops at a page limit rather than running forever.
- **Tokens expire after a year**, so a sync failing with "not accepted" is a
  normal end state, not a bug. It is recorded against the reader and shown next
  to their name in [settings](settings.md).

Their shapes are parsed at the boundary with Zod
([ADR 0009](../adrs/0009-zod-schemas-shared-between-api-and-client.md)), and the
cached JSON columns are read defensively: they are undocumented in shape, so an
unrecognised one yields nothing rather than failing a whole sync.

### When it runs

On demand from [settings](settings.md), immediately after a reader links an
account, and hourly in the background. The hourly figure is fixed in code rather
than exposed as a setting: every sync is a full sweep of someone's library, which
is not something to invite anyone to run every minute against a rate-limited API.
Incremental sweeps — Hardcover reports `updated_at` per entry — are the obvious
next optimisation, and are not needed while nothing else is right yet.

### One row per source, one card per book

Reconcile matches a Hardcover book to a `books` row **only by Hardcover's own
book id**. It never looks at title, ISBN, or anything a Calibre row might share
— deciding that two rows are the same book is a separate concern with its own
rules, and it runs afterwards
([book matching](book-matching.md), [ADR 0013](../adrs/0013-group-duplicate-books-into-works.md)).

So a book in both libraries is two rows that both survive, grouped under one
work and drawn as one card carrying both [marks](book-list.md). Keeping both
rows is what makes that reversible: neither source's record is damaged by the
other, and un-grouping is an `UPDATE`, not a reconstruction.

A book the matcher can't place stays its own card. That is the visible cost of a
deliberately narrow matcher, and it is the right way round — a duplicate on the
shelf is an annoyance, two different books declared identical is a corruption.

### Covers

Downloaded and cached on disk at the same three sizes as Calibre's
([ADR 0007](../adrs/0007-user-data-and-asset-storage-location.md)), so a
Hardcover book's cover draws with the network off like every other cover, and
nobody's shelf tells Hardcover's CDN what they are looking at.

The difference from Calibre is who does the scaling. Calibre resizes on request,
so we ask it for each size; Hardcover gives one image and no way to ask for a
smaller one, so **Grimoire scales it**, decoding once and writing all three.

That resizer is **pure JavaScript on purpose**. The fast ones are native
modules, and a native module is a per-platform binary the Electrobun bundle does
not carry — it would make covers work in the server and in `bun dev` and break
the desktop app outright, which is exactly the asymmetry
[ADR 0002](../adrs/0002-one-http-api-three-delivery-targets.md) exists to
prevent. A few hundred milliseconds per book, once, in a background sync, is
worth paying to keep all three targets identical.

Rules the cache follows:

- **Never upscale.** An image smaller than a size we cache is written as it is.
- **All three sizes or none.** A book with two of three on disk would be a cache
  that lies, so any failure leaves the book marked and nothing half-written.
- **A failure is marked, not retried.** A cover that 404s or isn't an image
  marks the book `missing` rather than being re-fetched every sync.
- **A changed URL invalidates the file.** Reconcile resets the book's cover
  state when Hardcover reports a different image, which is the one thing that
  should make us fetch again.

`books.cover_url` stays as the fallback the shelf draws *while* a cover is still
waiting to be downloaded — a first sync shows covers immediately rather than a
wall of placeholders. Once the file is cached, or once fetching it has failed,
the payload stops offering the URL.

**A grouped book keeps every member's cover**, and that is the point rather than
an oversight. Covers are named by the member row that holds them
([ADR 0013](../adrs/0013-group-duplicate-books-into-works.md)), so a book in two
libraries has two on disk: Calibre's edition and Hardcover's. The shelf serves
Calibre's today, chosen by a rule rather than by anyone; keeping both is what
lets a reader pick later without a re-sync. The cost is a few hundred kilobytes
per matched book, which is the cheapest part of this whole design.

## Data model

Owned by `packages/core/src/db.ts`. Two mirror tables, matching the split
`calibre_books` already established — what they said, kept apart from what
Grimoire decided to keep.

### `hardcover_books` — the book, as Hardcover has it

Keyed by Hardcover's book id, which unlike Calibre's is global rather than
scoped to a library, and is therefore usable as identity on its own.

```sql
CREATE TABLE hardcover_books (
  hardcover_id INTEGER PRIMARY KEY,
  title        TEXT NOT NULL,
  subtitle     TEXT,
  authors      TEXT NOT NULL DEFAULT '[]',   -- JSON array, from cached_contributors
  description  TEXT,
  pages        INTEGER,
  release_date TEXT,
  slug         TEXT,                         -- builds a hardcover.app URL
  tags         TEXT NOT NULL DEFAULT '[]',   -- JSON array, from cached_tags
  cover_url    TEXT,
  raw          TEXT NOT NULL,
  synced_at    TEXT NOT NULL
);
```

Shared across readers: two people who both shelved a book get one row here and
one row each below.

### `hardcover_user_books` — the reader's relationship with it

```sql
CREATE TABLE hardcover_user_books (
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hardcover_book_id INTEGER NOT NULL,
  user_book_id      INTEGER NOT NULL,   -- Hardcover's own user_books.id
  status_id         INTEGER NOT NULL,   -- 1 want, 2 reading, 3 read, 4 paused, 5 DNF, 6 ignored
  rating            REAL,               -- theirs, 0–5 with halves. Not Grimoire's stars.
  owned             INTEGER NOT NULL DEFAULT 0,
  read_count        INTEGER,
  date_added        TEXT,
  first_read_date   TEXT,
  last_read_date    TEXT,
  updated_at        TEXT,               -- Hardcover's; an incremental sweep would key on this
  raw               TEXT NOT NULL,
  synced_at         TEXT NOT NULL,
  PRIMARY KEY (user_id, hardcover_book_id)
);
```

Keyed by reader and book rather than by Hardcover's `user_books.id`: the query
asks for one entry per book (`distinct_on: book_id`), and "this reader's take on
this book" is the thing every later feature wants to look up. Unlike `books`,
rows here **are** deleted when a book leaves someone's shelves — this is a mirror
of their library right now, not a history.

Cascades off the reader, so removing one — which nothing does yet — cannot leave
another person's shelf data behind under a dead id.

### `books` and `users`

`books` gains two columns:

```sql
hardcover_id INTEGER UNIQUE,   -- identity for a hardcover-sourced row; never cleared
cover_url    TEXT              -- a remote cover, for books with no cached file
```

`hardcover_id` is deliberately shaped like `calibre_uuid` rather than
`calibre_id`: it identifies, it is unique, and it is never cleared. `books.source`
now carries `'hardcover'` as well as `'calibre'` — and stays a single value per
row, because a book in both libraries is two rows sharing a work rather than one
row from two places ([ADR 0013](../adrs/0013-group-duplicate-books-into-works.md)).

`users` gains the reader's Hardcover id (needed to ask for their library at all)
and the state of their last sync:

```sql
hardcover_user_id  INTEGER,
hardcover_synced_at TEXT,
hardcover_sync_error TEXT
```

## API

- `POST /api/users/:id/hardcover/sync` — sync that reader now, answering with
  their updated record. Runs to completion in the request; there is no progress
  readout yet.
- `GET /api/users` carries each reader's Hardcover username, book count, status
  counts, last sync time and last sync error — everything
  [settings](settings.md) shows, and never the token.

## Acceptance criteria

- [ ] Every book on a linked reader's Hardcover shelves lands in
      `hardcover_books` and `hardcover_user_books`, with its status. *(Verified
      with synthetic payloads; the live query needs a real token.)*
- [x] Those books appear on the shelf, marked as coming from Hardcover.
- [x] A book in both Calibre and Hardcover keeps both rows, neither damaged by
      the other, and is drawn as one card ([book matching](book-matching.md)).
- [x] A reader's Hardcover rating is in the mirror and *not* in `ratings`.
- [x] Un-shelving a book on Hardcover removes the `hardcover_user_books` row on
      the next sync, and leaves the `books` row alone.
- [x] Two linked readers sharing a book produce one `hardcover_books` row and
      two `hardcover_user_books` rows.
- [x] Reconciling twice over an unchanged mirror inserts nothing.
- [x] A Hardcover book's cover is downloaded, scaled to all three sizes, and
      served from disk — with a source smaller than a size left at its own size
      rather than upscaled.
- [x] A cover that 404s, or that answers with something that isn't an image, is
      marked and not fetched again; a changed URL is fetched again.
- [x] A rating serialised as a string, and a book missing its `cached_*` blobs,
      both survive rather than failing the page they arrived on.
- [ ] A library larger than one page pages through it, without exceeding
      Hardcover's rate limit. *(Paging and pacing are written; only a real
      account can prove it.)*
- [x] An expired token fails the sync, records the reason against that reader,
      and leaves every other reader syncing.
- [x] Unlinking a reader takes their shelf entries with it and leaves `books`
      alone.
- [x] Settings shows, per linked reader, their book count, what they're reading,
      when they last synced, and any error.

## Open questions

- **Matching is narrow, and has no identifiers.** Grimoire holds no ISBN from
  Hardcover — their depth-3 limit put `editions` out of reach of this sweep — so
  [book matching](book-matching.md) runs on titles and authors alone. Fetching
  them is a second query against ids already mirrored.
- **Full sweeps only.** `user_books.updated_at` is mirrored and unused; an
  incremental sweep is the obvious next step for anyone with a large shelf.
- **A book un-shelved on Hardcover keeps its `books` row forever**, exactly as a
  book deleted from Calibre does — except this one may never have been read,
  owned or rated. "Sync never deletes" was written for books someone had a
  relationship with, and this is the first case that tests it.
- **Merged books.** Hardcover dedupes its own catalogue and can retire an id in
  favour of a canonical one. Nothing here follows `canonical_id`, so a merged
  book can arrive as a second row.
- **Editions are ignored.** A `user_book` names the edition someone is reading,
  which is where page counts and covers actually differ; the mirror takes the
  book-level record.
- **No progress or journals.** `user_book_reads` carries page-level progress and
  is not fetched — the depth limit makes it a second query, and nothing renders
  it yet.
- **Nobody can choose the cover yet.** Both are kept on purpose, and a matched
  book still shows Calibre's because a rule says so. Letting a reader pick means
  storing the choice against the work and a control to make it with.
- **No cover refresh.** A cover is fetched once and re-fetched only if the URL
  changes. Hardcover swapping the image behind the same URL goes unnoticed.
- **Nothing is written back.** Rating or shelving a book in Grimoire does not
  reach Hardcover, and would need its own decision about which side wins.
