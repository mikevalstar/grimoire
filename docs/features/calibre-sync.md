---
type: feature
title: Calibre sync
description: A background job that mirrors the Calibre content server into grimoire.db and caches every cover locally, so the library renders from our own tables and survives Calibre being down.
tags: [sync, data, calibre, storage, ui]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-11 }
---

# Calibre sync

## Summary

Grimoire pulls the whole Calibre library into its own database on a timer,
caches each book's cover on disk, and reconciles that mirror into a `books`
table. Every library screen reads from `grimoire.db` rather than from Calibre,
and a sync indicator in the header says whether the copy is current.

## Motivation

Grimoire needs a book record it owns: one that can carry ratings, shelves and
progress, that survives a book leaving Calibre, and that other sources can write
into later. It also needs the library to render when `calibre-server` is not
running. On a desktop app, that is whenever someone quits it.

Calibre stays authoritative for everything it knows about
([ADR 0005](../adrs/0005-calibre-content-server-as-the-data-source.md)); this is
a cache with a reconciliation step, not a fork. The architecture is settled in
[ADR 0011](../adrs/0011-sync-calibre-into-grimoire-db-and-read-the-library-from-there.md).

## Behavior

### The shape of a sync

One sync is three phases, in order:

1. **Mirror.** Ask Calibre what it has and write it verbatim into
   `calibre_books`.
2. **Reconcile.** Fold the mirror into `books`, Grimoire's own record.
3. **Covers.** For books whose cover is new or changed, fetch and cache it.

Covers come last because cover files are named by the Grimoire book id, not
Calibre's. That is what lets a book keep its cover after Calibre deletes it,
and it is why the browser never needs to know a Calibre id exists.

Only one sync runs at a time per Grimoire instance. The scheduler lives in
`packages/api`, so the desktop app, the hosted server and `bun dev` each get
exactly one syncer no matter how many browser tabs are open.

One database, one scheduler: a second process syncing the same `grimoire.db`
would put two writers on one WAL file. The desktop shell
([`apps/desktop/src/bun/index.ts`](../../apps/desktop/src/bun/index.ts)) claims
the default API port before it builds the API. A launch that loses that race,
because another instance or the standalone server is already running, starts
with `sync: false` and serves the UI only.

### Mirroring incrementally

Calibre reports a `last_modified` per book and can sort by it, which gives us
change detection. Sweep the ids newest-modified first, walk them in pages, and
stop as soon as a page holds nothing newer than the stored watermark. Ids absent
from the sweep are deleted books, and sync drops their mirror rows.

The result is that an unchanged library costs two requests and no writes per
tick, and only a library where hundreds of books changed at once pays for pages.
A manual sync ignores the watermark and does a full pass, so "it looks wrong,
re-sync" is real.

### Noticing that the library underneath us changed

The mirror holds one Calibre library at a time. Book ids are per-library and
sequential, so if the configured server is repointed at a different library and
we go on syncing incrementally, two id-spaces get merged and `calibre_id` values
end up naming the wrong books.

**Calibre's `library_id` cannot detect this, and nobody should reach for it
later.** It is not an identifier Calibre generates and keeps; it is a slug of
the library folder's own name. So it fails both ways. Renaming the folder
changes it though the library did not, and, in the dangerous direction, two
unrelated libraries that both live in a folder called "Calibre Library" produce
byte-identical ids. Calibre exposes no library uuid over HTTP to fall back on.

So sync checks identity where it is reliable, per book, by uuid. If a
`calibre_id` ever reports a different `uuid` than the row we hold for it, the id
space has been reassigned, so sync empties the mirror and does a full pass.
Because incremental ticks only fetch *changed* books, each tick also re-checks a
small sentinel set of the lowest ids it holds, so a swapped library whose
timestamps all sit below the watermark cannot slip past. Sync still stores
`library_id` as a label for diagnostics, never as identity.

### Reconciling into `books`

**Matching is by Calibre's `uuid`, never by its book id.** Ids are sequential
and scoped to one library, so id 42 is a different book in every library anyone
points Grimoire at. Matching on it would overwrite one book's record with
another's the first time someone connected a second library.

- **In the mirror, not in `books`** → insert, with `source = 'calibre'`.
- **In both** → update the mirrored fields and refresh `calibre_id`, which may
  have changed. Sync never touches the fields Grimoire owns.
- **In `books`, gone from the mirror** → the row stays and keeps its
  `calibre_uuid`; sync clears only `calibre_id`. **Sync never deletes a book.**
  Someone's rating, shelf placement or reading progress is not Calibre's to
  revoke.

That split is the whole point of using the uuid. `calibre_id` is volatile
plumbing, the number that builds a download URL, meaningful only against the
library currently connected. `calibre_uuid` is identity, and nothing ever clears
it. Point Grimoire at a second library and the first library's books stay
as rows with a uuid and no id; point it back and every one re-links, with
nothing duplicated and no stars lost. A book deleted and re-added inside Calibre
is the one case that does not re-link, because Calibre mints it a fresh uuid.
As far as anything outside Calibre can tell, that is a new book.

Reconcile is all-or-nothing in one transaction. A half-applied pass would leave
books pointing at ids from two different libraries, the state this design exists
to prevent. Sync skips reconcile when the mirror phase changed nothing, so an
idle library costs no writes at all.

A book with no `calibre_id` has no download button. The file lives in Calibre
and the proxy has nothing to point at. It keeps its metadata and its cached
covers, and the UI marks it as no longer in the library.

### Covers

Three fixed sizes: a row thumbnail, a grid card, and a full size for the detail
panel that does not exist yet. They live on disk under the data dir
([ADR 0007](../adrs/0007-user-data-and-asset-storage-location.md)), named by
Grimoire's book id and sharded so no directory holds a hundred thousand entries.
Calibre does the scaling. A book Calibre has no cover for is marked missing, and
sync does not retry it every minute; the placeholder in
[book list](book-list.md) handles it.

The whole cover tree is disposable. Deleting it costs a re-sync and nothing
else. For that to be true, a full sync checks the filesystem for every book it
believes is cached and re-queues whatever has gone missing. Incremental ticks
skip that check.

A full sync also re-tries the books marked missing. A failure stamps the book
with the timestamp it was checked against, so the staleness test that queues
covers would never queue them again. A restarting content server could otherwise
mark a whole library missing for good. Only a full sync retries: refetching every
failure every minute is how a library with genuinely coverless books hammers the
content server forever.

### The sync indicator

A button in the header, in three states: idle, with the last sync time in its
tooltip; syncing, with the phase and progress; and failed, in destructive red,
carrying the actual error and the proxy's hint when the content server is
unreachable. The failed state persists until the next successful sync,
so a failure at 3am is still visible at 9am. The tooltip is the shell's shared
one ([ADR 0016](../adrs/0016-react-tooltip-for-hover-affordances.md)); the same
text is also the button's accessible name, so the error is never hover-only.

Clicking starts a sync. Clicking during one does nothing rather than queueing a
second, but the button stays hoverable so its progress is still readable. Motion
is `motion-safe` only. Reduced-motion users get a pulse rather than a spin, so
movement alone never carries "something is happening".

### When syncs happen

At startup once a content server URL exists; on the interval, default five
minutes; when the [setup wizard](first-run-setup-wizard.md) finishes or the
server URL changes in [settings](settings.md), so a new library appears without
waiting out a timer; and on demand from the indicator or settings. With no
content server configured the scheduler stays idle and reports nothing. An
unconfigured app is not a failing one.

[Settings](settings.md) surfaces the last sync, the book count, the last error,
the interval and a Sync now button.

## Data model

Owned by `packages/core/src/db.ts`, which holds the schema and every migration.

### `calibre_books`: the mirror

A verbatim copy of what the content server said, and nothing else. Rows here
*are* deleted when a book leaves Calibre; this is a cache of the connected
library's current state, not a history.

Keyed by `calibre_id`, because that is what the sweep returns and what deletion
detection compares. But `uuid` is `NOT NULL UNIQUE`, because that is what
reconcile matches on.

```sql
CREATE TABLE calibre_books (
  calibre_id      INTEGER PRIMARY KEY,      -- per-library, sequential, volatile
  uuid            TEXT NOT NULL UNIQUE,     -- the identity reconcile matches on
  library_id      TEXT NOT NULL,            -- a label for diagnostics, NOT identity
  title           TEXT NOT NULL,
  title_sort      TEXT,
  authors         TEXT NOT NULL DEFAULT '[]',   -- JSON array
  author_sort     TEXT,
  series          TEXT,
  series_index    REAL,
  tags            TEXT NOT NULL DEFAULT '[]',   -- JSON array
  formats         TEXT NOT NULL DEFAULT '[]',   -- JSON array, uppercased
  publisher       TEXT,
  languages       TEXT NOT NULL DEFAULT '[]',   -- JSON array
  identifiers     TEXT NOT NULL DEFAULT '{}',   -- JSON object
  comments        TEXT,                     -- Calibre's description (HTML)
  pages           INTEGER,
  pubdate         TEXT,
  timestamp       TEXT,                     -- when Calibre took the book in
  last_modified   TEXT NOT NULL,            -- drives change detection
  has_cover       INTEGER NOT NULL DEFAULT 1,
  raw             TEXT NOT NULL,            -- the whole /ajax/books entry, verbatim
  synced_at       TEXT NOT NULL
);

CREATE INDEX calibre_books_last_modified ON calibre_books (last_modified);
CREATE INDEX calibre_books_uuid          ON calibre_books (uuid);
```

JSON in `TEXT` columns rather than child tables, so a sync is one upsert per
book and a failure can't leave half a book behind. `raw` keeps the original
payload. Calibre carries custom columns and per-format metadata we don't model
yet, and keeping it means adding a field later is a re-derive rather than a full
re-sync.

### `books`: Grimoire's record

The table every screen reads. One row per book Grimoire knows about, from any
source, forever.

```sql
CREATE TABLE books (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  source          TEXT NOT NULL,            -- 'calibre' | later: 'hardcover', 'grimoire'
  calibre_uuid    TEXT UNIQUE,              -- identity: set once, never cleared
  calibre_id      INTEGER,                  -- volatile: NULL when not in the connected library
  title           TEXT NOT NULL,
  title_sort      TEXT,
  authors         TEXT NOT NULL DEFAULT '[]',
  author_sort     TEXT,
  series          TEXT,
  series_index    REAL,
  tags            TEXT NOT NULL DEFAULT '[]',
  formats         TEXT NOT NULL DEFAULT '[]',
  publisher       TEXT,
  languages       TEXT NOT NULL DEFAULT '[]',
  identifiers     TEXT NOT NULL DEFAULT '{}',
  description     TEXT,
  pages           INTEGER,
  published       TEXT,
  added           TEXT NOT NULL,
  cover_state     TEXT NOT NULL DEFAULT 'none',  -- 'none' | 'cached' | 'missing'
  cover_synced_at TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE INDEX books_title_sort ON books (title_sort);
CREATE INDEX books_source     ON books (source);
CREATE INDEX books_calibre_id ON books (calibre_id);
```

The two Calibre columns do different jobs. `calibre_uuid` is identity: `UNIQUE`,
never cleared, and nullable so a future non-Calibre source needs no placeholder.
`calibre_id` is a cached pointer into whichever library is connected, so it is
deliberately *not* unique and carries no foreign key. After a library switch the
same integer legitimately describes a different book. `calibre_id IS NOT NULL`
is therefore the exact test for "in the library right now".

`source` names where the record was ingested from, so the field always answers
"where did this come from?".

### `ratings`

Keyed on `works.id` now ([ADR 0013](../adrs/0013-group-duplicate-books-into-works.md)),
having been keyed on `books.id` here first. A rating can no longer outlive its
book as an orphan row keyed to a number nothing owns, *and* it does not split in
two when the same book turns up from a second source. Because sync never
deletes a `books` row, a reader's stars survive a book leaving Calibre. See
[rating a book](rating-a-book.md).

### Sync state

Kept in the existing key/value preferences store rather than its own table: when
the last sync completed and was attempted, its status, the last error and hint,
the watermark, and the interval. Live progress is in-process state on the
scheduler. It changes every few hundred milliseconds and is worthless after a
restart.

## API

`GET /api/books` serves the library and `GET /api/books/:id/cover/:size` serves
a cached cover; `GET`, `POST /api/sync` and `PUT /api/sync/settings` report
status, start a full sync and set the interval. `/api/cs` remains, for downloads
and for the sync job itself. Every payload has a Zod schema shared by API and
client ([ADR 0009](../adrs/0009-zod-schemas-shared-between-api-and-client.md)).

The web client polls sync status, and invalidates the books query when a sync
completes.

## Acceptance criteria

- [x] A sync mirrors every Calibre book, reconciles it into `books`, and caches
      covers at all three sizes under the data dir.
- [x] The library screen renders entirely from Grimoire's own tables and cached
      covers, with the content server stopped, and the sync reports why.
- [x] A book deleted in Calibre keeps its row, metadata, covers and
      `calibre_uuid`; only `calibre_id` is cleared, and the UI says it is no
      longer in the library.
- [x] A book edited in Calibre shows its new metadata within one interval.
- [x] An unchanged library costs two requests per tick and writes nothing.
- [x] Pointing Grimoire at a second library adds that library's books rather
      than overwriting the first's, and pointing it back re-links every original
      book by uuid, with no duplicates and no lost ratings.
- [x] That holds when both libraries report the same `library_id`: the swap is
      caught by a `calibre_id` reporting a new `uuid`, not by the library name.
- [x] A book deleted and re-added in Calibre onto a recycled id does not inherit
      the previous occupant's Grimoire row.
- [x] Ratings cascade with the book, keyed on `books.id` when this was written
      and on `works.id` since ([ADR 0013](../adrs/0013-group-duplicate-books-into-works.md));
      a rating set before a book left Calibre is still there afterwards.
- [x] The header indicator turns red on failure with the real error in its
      tooltip, survives until the next successful sync, starts a sync when
      clicked, and gives reduced-motion users a non-rotating cue.
- [x] Settings shows last-synced time, book count, the last error, a working
      interval select and a Sync now button.
- [x] Two syncs never run at once, and the app never syncs before a content
      server is configured.
- [x] A sync interrupted mid-way leaves the database consistent and the next
      sync picks up.
- [x] Deleting the cover cache and syncing restores every cover.
- [x] The indicator has a Storybook story covering all three states, in both
      themes.

## Open questions

- **Cover invalidation is coarse.** `last_modified` moves when any field
  changes, so editing a title refetches every size. Refetching is cheap and
  correct; a stale cover is neither.
- **`raw` costs storage.** A large library carries a lot it may never read.
  Worth it while the schema is still moving; worth revisiting once nothing new
  is being derived from it.
- **First sync on a large library is a stampede.** There is no resume: a first
  sync killed half way refetches covers it already has.
- **Reconcile is all-or-nothing.** One changed book rewrites every row. Fine at
  a few thousand books; at a hundred thousand it wants a dirty-set, which means
  the mirror recording what each sweep actually wrote.
- **Multiple Calibre libraries at once.** Matching on uuid makes connecting a
  second library *safe*, but only one is mirrored at a time. Browsing two
  together needs a library selector, per-library routes, and a mirror keyed by
  library. That key cannot be Calibre's `library_id`, for the reasons above. A
  Grimoire-minted library key is the likely answer.
- **The sentinel set is a heuristic, not a proof.** It catches a library swap
  essentially always and costs nothing, but a contrived case would slip through
  until a manual sync. Making it exact means the full sweep the watermark exists
  to avoid.
- ~~**A second source needs its own key columns.**~~ Answered: each source keeps
  its own identity columns on its own row, and a book held by two sources is two
  rows sharing a `works` row, so `source` stays a single value per row
  ([ADR 0013](../adrs/0013-group-duplicate-books-into-works.md),
  [book matching](book-matching.md)).
- **Which Calibre fields become first-class.** Several are mirrored and
  reconciled but nothing renders them until the detail panel exists.
- **Custom columns.** Modelling Calibre's `#read` means deciding whether
  Grimoire's own read state or Calibre's wins. That belongs to a read-status
  feature.
- **No sync history.** Only the last result is kept. Diagnosing intermittent
  failures would want a trail.
- **Search.** Server-side search and paging are the same decision as filtering
  ([book list](book-list.md)), and are unblocked, not answered, by this.
