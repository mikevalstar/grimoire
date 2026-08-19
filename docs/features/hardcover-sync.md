---
type: feature
title: Hardcover sync
description: Pulls every book on a linked reader's hardcover.app shelves, with its status and rating, into grimoire.db and onto the shelf. A book already held in Calibre groups with its Hardcover row rather than showing twice.
tags: [sync, data, hardcover, users, storage]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-14 }
---

# Hardcover sync

## Summary

For each reader with a [linked Hardcover account](hardcover-connection.md),
Grimoire pulls their whole library into its own tables: every book they've
shelved, with its status, rating and dates. It then folds those books into
`books` so they appear on the shelf.

A book you own in Calibre *and* track on Hardcover is **two rows and one card**.
Grimoire keeps both rows, and [book matching](book-matching.md) groups them under
one work ([ADR 0013](../adrs/0013-group-duplicate-books-into-works.md)). This
sync does no matching of its own. It writes rows and lets that pass decide what
is the same book.

## Motivation

Matching books across two sources is the hard problem, and it cannot be designed
against a hypothesis. Get the real data in first: real titles, real author
spellings, real identifiers, sitting next to the Calibre rows they will have to
be matched with. That turns "how do we match these?" from a thought experiment
into a query.

Reading state is the half Calibre does not have at all. Want-to-read, currently
reading, finished, DNF, and when each of those happened are things Grimoire has
no way to know today. They are per reader, which is why the credential is too
([ADR 0012](../adrs/0012-hardcover-as-a-second-source-with-per-reader-tokens.md)).

## Behavior

### The shape of a sync

Per reader, and only readers who have linked an account:

1. **Mirror.** Page through their `user_books` and write both halves verbatim:
   the book into `hardcover_books`, their relationship with it into
   `hardcover_user_books`.
2. **Reconcile.** Fold `hardcover_books` into `books`, matched on Hardcover's
   book id.

3. **Covers.** Download each book's image and scale it onto disk, at the same
   three sizes Calibre's covers are cached at. See [Covers](#covers).

Covers come last for the same reason they do in the
[Calibre sync](calibre-sync.md): cover files are named by the book id that
reconcile assigns.

The same rules the [Calibre sync](calibre-sync.md) works under hold here:
**sync never deletes a `books` row**, one sync at a time per reader, and the
whole reconcile is one transaction.

### What comes across

Everything the shelf might want about the book: title, subtitle, description,
pages, release date, contributors, tags, series, cover URL. And everything about
the reader's relationship with it: status, their rating, whether they own a
copy, how many times they've read it, and the added / first-read / last-read
dates.

**Series come across as records, not as a line of text.** Hardcover's
`book_series` gives a book any number of series, each with a position and a
`featured` flag. So a sweep writes the series themselves and the work's
attachments to them
([ADR 0019](../adrs/0019-series-as-records-with-a-primary-per-work.md)), rather
than flattening them into one string.

Getting the names costs a second request per page, because of the depth limit
below. `user_books { book { book_series { series } } }` is four levels and their
queries stop at three, so a page can only carry series *ids*. One
`series(where: { id: { _in: … } })` per page names them before the mirror stores
them, the same two-step the finder makes and for the same reason. A hydrate that
fails costs that page its series names, not its books: reconcile skips an entry
with no name, and the next sweep picks it up.

**Grimoire follows their merges.** A series carrying a `canonical_id` is one
their librarians folded into another, so Grimoire stores the canonical id.
Without that, a merge on their side would leave two Discworlds here and split the
shelf between them. Reconcile recomputes those attachments on
every sweep and leaves any a person set by hand
([setting a series from Hardcover](setting-a-series-from-hardcover.md)) alone.
Whether a Hardcover series or Calibre's wins where both have one is the
**Series** switch in [settings](settings.md).

Statuses are Hardcover's own numbering, and Grimoire stores the integer they
send:

| id | status |
|----|--------|
| 1 | Want to Read |
| 2 | Currently Reading |
| 3 | Read |
| 4 | Paused |
| 5 | Did Not Finish |
| 6 | Ignored |

The `raw` column keeps the whole `user_books` entry as well, the same bet
[Calibre sync](calibre-sync.md) makes: their API carries far more than we model,
and keeping the payload means adding a field later is a re-derive rather than a
re-sync of everyone's account.

**Grimoire reads two things live rather than mirroring them**: a book's reading
history, and the writing about a book the
[details panel](book-details-panel.md) can show in place of Calibre's, meaning
description, tags and moods. It asks for both only when a panel is open, so they
are current when somebody is looking without making every sweep wider. Neither
goes back into the mirror. The mirror's own `description` and `tags` columns stay
what reconcile uses.

**Hardcover ratings do not become Grimoire ratings.** They land in the mirror and
stop there. Stars in Grimoire are the reader's own verdict recorded here
([rating a book](rating-a-book.md)); importing another service's would make a
book someone never rated in Grimoire look rated. Whether the two should ever meet
is a question for the matching design, which is where a book can finally have
both.

### Talking to their API

One GraphQL query, paged with `limit`/`offset` and `distinct_on: book_id`, run
from the server ([ADR 0012](../adrs/0012-hardcover-as-a-second-source-with-per-reader-tokens.md)).
Three of their limits shape it:

- **Their queries cap at depth 3**, so the nested `contributions { author {
  name } }` their examples use is out of reach. The book's cached JSON columns
  carry the same information one level shallower: contributors, image, tags. The
  mirror reads those instead.
- **60 requests a minute, per account.** See
  [Staying under the rate limit](#staying-under-the-rate-limit). A sweep also
  stops at a page limit rather than running forever.
- **Tokens expire after a year**, so a sync failing with "not accepted" is a
  normal end state, not a bug. Grimoire records it against the reader and shows
  it next to their name in [settings](settings.md).

### Staying under the rate limit

A sweep is not the only thing spending the budget, and a page is not one
request. The sweep costs two per page: the shelf page, then the query that names
its series. Meanwhile an open [details panel](book-details-panel.md) is reading a
book live, the finder is searching, and a rating is going back. All of it is one
reader's token against one 60-a-minute ceiling.

So the pacing is not in the sweep. Every Hardcover request this process makes
goes through a **token bucket**, one per token, in
[`hardcover-rate-limit.ts`](../../packages/api/src/hardcover-rate-limit.ts). It
sits under the single function that fetches their URL at all, so nothing can
route around it. It refills at 55 a minute, under their 60 for headroom, and
holds a burst of the same size: an idle Grimoire answers a panel's two or three
reads at once, and a sweep of thousands settles to the sustained rate on its own.
The sweep's loop asks for pages and waits however long the bucket makes it wait.

**A 429 does not fail the sync.** Their accounting can still disagree with ours,
whether from a second client on the same token or a window that began earlier
than we think. A rate-limited request pauses *every* request on that token,
honours `Retry-After` when their gateway sends one, backs off a window at a time
when it doesn't, then retries. Only after three attempts does the error reach
the reader. Before this, one 429 mid-sweep failed the whole sync, and with no
partial-progress resume the next hourly run failed at the same page.

Zod parses their shapes at the boundary
([ADR 0009](../adrs/0009-zod-schemas-shared-between-api-and-client.md)). The
cached JSON columns get read defensively, since their shape is undocumented: an
unrecognised one yields nothing rather than failing a whole sync.

### When it runs

On demand from [settings](settings.md), immediately after a reader links an
account, and hourly in the background. The hourly figure is fixed in code rather
than exposed as a setting. Every sync is a full sweep of someone's library, which
is not something to invite anyone to run every minute against a rate-limited API.
Incremental sweeps are the obvious next optimisation, since Hardcover reports
`updated_at` per entry, and they are not needed while nothing else is right yet.

### One row per source, one card per book

Reconcile matches a Hardcover book to a `books` row **only by Hardcover's own
book id**. It never looks at title, ISBN, or anything a Calibre row might share.
Deciding that two rows are the same book is a separate concern with its own
rules, and it runs afterwards
([book matching](book-matching.md), [ADR 0013](../adrs/0013-group-duplicate-books-into-works.md)).

So a book in both libraries is two rows that both survive, grouped under one
work and drawn as one card carrying both [marks](book-list.md). Keeping both
rows is what makes that reversible: neither source's record damages the other,
and un-grouping is an `UPDATE`, not a reconstruction.

A book the matcher can't place stays its own card. That is the visible cost of a
deliberately narrow matcher, and it is the right way round. A duplicate on the
shelf is an annoyance; two different books declared identical is a corruption.

### Covers

Grimoire downloads and caches them on disk at the same three sizes as Calibre's
([ADR 0007](../adrs/0007-user-data-and-asset-storage-location.md)), so a
Hardcover book's cover draws with the network off like every other cover, and
nobody's shelf tells Hardcover's CDN what they are looking at.

The difference from Calibre is who does the scaling. Calibre resizes on request,
so we ask it for each size; Hardcover gives one image and no way to ask for a
smaller one, so Grimoire scales it, decoding once and writing all three.

That resizer is pure JavaScript on purpose. The fast ones are native modules,
and a native module is a per-platform binary the Electrobun bundle does not
carry. It would make covers work in the server and in `bun dev` and break the
desktop app outright, which is exactly the asymmetry
[ADR 0002](../adrs/0002-one-http-api-three-delivery-targets.md) exists to
prevent. A few hundred milliseconds per book, once, in a background sync, is
worth paying to keep all three targets identical.

**Some of their covers are WebP wearing a `.jpg`**, headers and all, which that
resizer cannot read on its own. A WASM decoder handles those and hands the
pixels over, chosen and wired for the same
all-three-targets-or-nothing reason
([ADR 0017](../adrs/0017-decode-webp-covers-with-a-wasm-codec.md)). The file's
own bytes decide, never the CDN's content type.

Rules the cache follows:

- **Never upscale.** Grimoire writes an image smaller than a cached size as it
  is.
- **All three sizes or none.** A book with two of three on disk would be a cache
  that lies, so any failure leaves the book marked and nothing half-written.
- **A *scheduled* sweep marks a failure rather than retrying it.** A cover that
  404s or isn't an image marks the book `missing`, and no hourly run fetches it
  again.
- **A full sweep tries the failures again.** Two things make a failure worth
  another attempt, and both answer the same problem. `missing` used to be
  permanent. One minute without a network cost every book on the shelf its cover
  until Hardcover next edited that book, because this is someone else's CDN and
  one pass fetches the whole shelf.
  - A manual sync is full: pressing the button is how a reader says "the
    covers didn't come down, try again", and it has to mean something.
  - A changed URL invalidates the file. Reconcile resets the book's cover
    state when Hardcover reports a different image.
- **A full sweep also reconciles against the disk.** It stats every cover the
  database calls cached and fetches back whatever has gone. That is the same
  promise [Calibre sync](calibre-sync.md) makes, and only this pass can keep it
  for these books: the Calibre pass rebuilds by re-fetching from a Calibre id,
  and a Hardcover-only book has none.

`books.cover_url` stays as the fallback the shelf draws *while* a cover is still
waiting to be downloaded, so a first sync shows covers instead of a wall of
placeholders. Once the file is cached, or once fetching it has failed, the
payload stops offering the URL.

**A grouped book keeps every member's cover**, and that is the point rather than
an oversight. Cover files are named by the member row that holds them
([ADR 0013](../adrs/0013-group-duplicate-books-into-works.md)), so a book in two
libraries has two on disk: Calibre's edition and Hardcover's. The shelf draws
Calibre's until someone says otherwise, and the
[details panel](book-details-panel.md) is where they say it. Keeping both on
disk is what makes that a click rather than a re-sync. The cost is a few hundred
kilobytes per matched book, the cheapest part of this whole design.

## Data model

Owned by `packages/core/src/db.ts`. Two mirror tables, matching the split
`calibre_books` already established: what they said, kept apart from what
Grimoire decided to keep.

### `hardcover_books`: the book, as Hardcover has it

Keyed by Hardcover's book id. Unlike Calibre's, that id is global rather than
scoped to a library, so it works as identity on its own.

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
  series       TEXT NOT NULL DEFAULT '[]',   -- JSON array, from book_series
  cover_url    TEXT,
  raw          TEXT NOT NULL,
  synced_at    TEXT NOT NULL
);
```

Shared across readers: two people who both shelved a book get one row here and
one row each below.

`series` is the mirror's copy of `book_series`, one entry per series with its
id, name, slug, size, this book's position and their `featured` flag. It stays a
JSON column here for the same reason `tags` does: the mirror keeps what they
said, and reconcile turns it into the `series` and `work_series` rows
([ADR 0019](../adrs/0019-series-as-records-with-a-primary-per-work.md)) the
shelf reads.

`slug` is what makes a mirrored book addressable on their site:
`https://hardcover.app/books/<slug>` is the public page, and it is a slug rather
than the numeric id. That is the whole reason the column is mirrored: the
[details panel](book-details-panel.md) links out with it, without a token and
without another request.

### `hardcover_user_books`: the reader's relationship with it

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
rows here **are** deleted when a book leaves someone's shelves. This is a mirror
of their library right now, not a history.

Cascades off the reader, so removing one, which nothing does yet, cannot leave
another person's shelf data behind under a dead id.

### `books` and `users`

`books` gains two columns:

```sql
hardcover_id INTEGER UNIQUE,   -- identity for a hardcover-sourced row; never cleared
cover_url    TEXT              -- a remote cover, for books with no cached file
```

`hardcover_id` is deliberately shaped like `calibre_uuid` rather than
`calibre_id`: it identifies, it is unique, and it is never cleared. `books.source`
now carries `'hardcover'` as well as `'calibre'`, and stays a single value per
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

- `POST /api/users/:id/hardcover/sync` syncs that reader now, answering with
  their updated record. It runs to completion in the request, and there is no
  progress readout yet. Pacing makes that request long, so every host serves
  with a 30s idle timeout rather than Bun's 10s default. A very large shelf can
  still outlast it, and the fix for that is a 202-plus-poll endpoint we have not
  built.
- `GET /api/users` carries each reader's Hardcover username, book count, status
  counts, last sync time and last sync error: everything
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
      served from disk, with a source smaller than a size left at its own size
      rather than upscaled.
- [x] A cover that 404s, or that answers with something that isn't an image, is
      marked and not fetched again; a changed URL is fetched again.
- [x] A rating serialised as a string, and a book missing its `cached_*` blobs,
      both survive rather than failing the page they arrived on.
- [ ] A library larger than one page pages through it, without exceeding
      Hardcover's rate limit. *(Paging is written and the bucket is tested on a
      fake clock; only a real account can prove the ceiling itself.)*
- [x] A 429 mid-sweep pauses and is retried rather than failing the sync, and a
      `Retry-After` is honoured when one is sent.
- [x] An expired token fails the sync, records the reason against that reader,
      and leaves every other reader syncing.
- [x] Unlinking a reader takes their shelf entries with it and leaves `books`
      alone.
- [x] Settings shows, per linked reader, their book count, what they're reading,
      when they last synced, and any error.

## Open questions

- **Matching is narrow, and has no identifiers.** Grimoire holds no ISBN from
  Hardcover: their depth-3 limit put `editions` out of reach of this sweep. So
  [book matching](book-matching.md) runs on titles and authors alone. Fetching
  them is a second query against ids already mirrored.
- **Full sweeps only, and no resume.** `user_books.updated_at` is mirrored and
  unused; an incremental sweep is the obvious next step for anyone with a large
  shelf. A sweep that fails part-way also discards the pages it did read and
  starts from offset 0 an hour later. That is survivable now that a 429 is
  retried, but a timeout or a dropped connection still costs the whole sweep.
  Resuming needs the offset persisted against the reader and a rule for when a
  stale one is no longer safe to trust.
- **A book un-shelved on Hardcover keeps its `books` row forever**, exactly as a
  book deleted from Calibre does, except this one may never have been read,
  owned or rated. "Sync never deletes" was written for books someone had a
  relationship with, and this is the first case that tests it.
- **Merged books.** Hardcover dedupes its own catalogue and can retire an id in
  favour of a canonical one. Nothing here follows `canonical_id`, so a merged
  book can arrive as a second row.
- **Nothing here uses editions.** A `user_book` names the edition someone is
  reading, which is where page counts and covers differ. The mirror takes the
  book-level record.
- **No progress or journals.** `user_book_reads` carries page-level progress and
  nothing fetches it. The depth limit makes it a second query, and nothing
  renders it yet.
- **Nobody can choose the cover yet.** Both are kept on purpose, and a matched
  book still shows Calibre's because a rule says so. Letting a reader pick means
  storing the choice against the work and a control to make it with.
- **No cover refresh.** A cover is fetched once and re-fetched only if the URL
  changes. Hardcover swapping the image behind the same URL goes unnoticed.
- **Nothing is written back.** Rating or shelving a book in Grimoire does not
  reach Hardcover, and would need its own decision about which side wins.
