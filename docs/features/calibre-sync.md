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
caches each book's cover at three sizes on disk, and reconciles that mirror into
a `books` table. Every library screen then reads from `grimoire.db` rather than from Calibre, and a sync indicator in the header says
whether the copy is current.

## Motivation

We wish to later enable other sources of books for editing and accessing.

Calibre stays authoritative for everything it knows about
([ADR 0005](../adrs/0005-calibre-content-server-as-the-data-source.md)); this
feature is a cache with a reconciliation step, not a fork.

The architecture is settled in
[ADR 0011](../adrs/0011-sync-calibre-into-grimoire-db-and-read-the-library-from-there.md)
— two tables, Calibre's `uuid` as identity, covers cached on disk, one scheduler
in `packages/api`. This spec is the design and the schema.

## Behavior

### The shape of a sync

One sync is three phases, in order:

1. **Mirror** — ask Calibre what it has and write it verbatim into
   `calibre_books`.
2. **Reconcile** — fold `calibre_books` into `books`, Grimoire's own record.
   New books are inserted, changed books updated, and books that have left
   Calibre keep their row but lose their `calibre_id`.
3. **Covers** — for books whose cover is new or changed, fetch and store it at
   three sizes.

Covers come *last*, after reconcile, because cover files are named by the
**Grimoire** book id. That is what lets a book keep its cover after it is
deleted from Calibre, and it is what the UI asks for — the browser never needs
to know a Calibre id exists.

Only one sync runs at a time, per Grimoire instance. The scheduler lives in
`packages/api`, so the desktop app, the hosted server and `bun dev` each get
exactly one syncer no matter how many browser tabs are open.

### Phase 1 — mirror

Calibre's `/ajax/books` returns a `last_modified` per book (verified against a
stock 5.x content server), and `/ajax/search` accepts
`sort=last_modified&sort_order=desc`. Together those give us change detection:

- `GET /api/cs/ajax/search?num=<all>&sort=last_modified&sort_order=desc` returns
  every book id, newest-modified first. This is the cheap call — ids only — and
  it is also how we learn what has been **deleted**: any `calibre_books` row
  whose id is absent is dropped.
- Walk that id list in pages of 200 through `GET /api/cs/ajax/books?ids=…`,
  upserting each entry. Stop as soon as a whole page contains no id we haven't
  seen and no `last_modified` newer than the stored watermark — because the list
  is sorted by `last_modified` descending, everything past that point is
  unchanged by definition.
- On success, the watermark advances to the newest `last_modified` ingested.

The honest caveat: `/ajax/search` returns ids, not timestamps, so the *first*
page of metadata is always fetched. A steady-state tick on an unchanged library
costs two requests and no writes. A tick after one edit costs two requests.
Only a library where hundreds of books changed at once pays for pages.

### Noticing that the library underneath us changed

The mirror holds **one** Calibre library at a time — whichever one
`calibre.serverUrl` currently points at. Book ids are per-library and sequential,
so if that library is swapped for another and we go on syncing incrementally, two
id-spaces get merged: mirror rows are matched against ids that now name different
books, and `calibre_id` values end up pointing at the wrong ones.

The obvious guard is Calibre's `library_id`, which appears in every
`/ajax/search` response. **It is not sufficient, and this is worth writing down
so nobody reaches for it later.** It is not an identifier Calibre generates and
keeps; it is a slug of the library folder's own name —
`~/Documents/Calibre Library` → `Calibre_Library`, `/data/Sci-Fi & Fantasy!` →
`Sci-Fi_&_Fantasy!` (confirmed against `calibre.srv.library_broker`'s
`library_id_from_path`). Its `make_library_id_unique` counter only dedupes
libraries served by *one running server*. So it fails both ways: renaming the
folder changes it though the library did not, and — the dangerous direction —
two unrelated libraries on two machines both sitting in a folder called "Calibre
Library" produce byte-identical ids. Repointing between them would look like no
change at all. There is no library uuid to fall back on: `metadata.db` has one,
but nothing over HTTP exposes it (`/ajax/library-info`, `/interface-data/init`
and `/interface-data/books-init` all carry only the slug).

So identity is checked where it is actually reliable — **per book, by uuid**:

- Every metadata page fetched is checked against the mirror. If any `calibre_id`
  now reports a **different `uuid`** than the row we hold for it, the id space
  has been reassigned. That is a different library (or, within one library, a
  book deleted and re-added onto a recycled id) and the response is the same
  either way: empty the mirror, reset the watermark, full pass.
- Because incremental ticks only fetch *changed* books, that check alone could
  be dodged — the new library's timestamps may all sit below our watermark and
  early-stop on page one. So the first metadata request of every tick also
  appends a **sentinel set**: the 20 lowest `calibre_id`s the mirror holds.
  `/ajax/books?ids=…` takes an arbitrary id list, so they ride along in a request
  we were making anyway, at no extra round trip.

This is strictly better than a library check, because it tests the thing we
actually depend on — that an id still means the book we think it means — rather
than a proxy for it. `library_id` is still stored on the mirror, but as a label
for diagnostics and UI, never as identity.

A **manual sync** ignores the watermark and does a full pass, so "it looks wrong,
re-sync" is real.

### Phase 2 — reconcile into `books`

`books` is Grimoire's own record and used by the ui. **Matching is by Calibre's
`uuid`, never by its book id.** Calibre ids are small sequential integers scoped
to one library, so id 42 is a different book in every library anyone points
Grimoire at; a uuid is generated per book when it is added and is unique across
libraries. Matching on the id would quietly overwrite one book's record with
another's the first time a second library was connected.

- **Present in the mirror, absent from `books`** → insert, with
  `source = 'calibre'` and `calibre_uuid` set.
- **Present in both** (same `calibre_uuid`) → update the mirrored fields, and
  refresh `calibre_id`, which may have changed. Fields Grimoire owns and Calibre
  knows nothing about are never touched by sync.
- **In `books` but gone from the mirror** → the row stays and keeps its
  `calibre_uuid`; only `calibre_id` is cleared. **Sync never deletes a book.**
  Someone's rating, shelf placement or reading progress is not Calibre's to
  revoke.

Reconcile is all-or-nothing over the whole mirror, in one transaction — a
half-applied pass would leave books pointing at ids from two different
libraries, which is the state this whole design exists to prevent. Because it
rewrites every row it is handed, it is **skipped entirely** when phase 1 changed
nothing, so an idle library costs no writes at all. The skip is guarded by a
count check (`books` still linked to as many rows as the mirror holds), so a
reconcile that never ran, or died half way, gets another chance on the next tick
rather than waiting for Calibre to change.

That split is the whole point of using the uuid: `calibre_id` is *volatile*
plumbing — the number that builds a download URL, meaningful only against the
library currently connected — while `calibre_uuid` is *identity* and is never
cleared. Point Grimoire at a second library and the first library's books stay
as rows with a uuid and no id; point it back and every one of them re-links by
uuid, with nothing duplicated and no stars lost. A re-add inside Calibre is the
one case that does not re-link, because Calibre mints a fresh uuid for it — that
is genuinely a new book as far as anything outside Calibre can tell.

`source` names where the record was ingested from — `'calibre'` today,
`'hardcover'` and a hand-entered `'grimoire'` later — so the field always
answers "where did this come from?".

A book with no `calibre_id` has no download button: the file lives in Calibre and
the proxy has nothing to point at. It keeps its metadata and its cached covers,
and the UI marks it as no longer in the library.

### Phase 3 — covers

Three sizes, all 2:3, all JPEG, all fetched from
`/api/cs/get/thumb/<calibreId>?sz=<w>x<h>` so Calibre does the scaling:

| Name    | Pixels    | Drawn at                                  |
| ------- | --------- | ----------------------------------------- |
| `thumb` | 80 × 120  | the list view's row thumbnail (28px @2×)  |
| `card`  | 360 × 540 | the cover grid's card (180px @2×)         |
| `full`  | 720 ×1080 | the detail panel, which does not exist yet |

Files land under the data dir
([ADR 0007](../adrs/0007-user-data-and-asset-storage-location.md)), sharded so
no directory holds a hundred thousand entries:

```
<dataDir>/covers/<bookId % 256, hex, 2 digits>/<bookId>-<size>.jpg
```

Covers are refetched when the book's `last_modified` moves past the
`cover_synced_at` we recorded. A book Calibre has no cover for is marked
`missing` and not retried every minute; the drawn placeholder already in
[book list](book-list.md) handles it.

The whole `covers/` tree is disposable — deleting it costs a re-sync and nothing
else. That only works if something notices the files have gone, though: the
database still says they are cached, and nothing above would look. So a **full**
sync checks the filesystem for every book it believes is cached and re-queues
whatever is missing. Incremental ticks skip that check — three stats per book
every minute is not a price worth paying to catch someone deleting files behind
Grimoire's back.

### Reading the library

A new `GET /api/books` serves the library from `books`, and
`GET /api/books/:id/cover/:size` serves a cached file with a long-lived
`Cache-Control` and an ETag. `/api/cs` stays for downloads and for the sync job
itself.

This supersedes how [book list](book-list.md) gets its data: `fetchBooks()`
stops calling `/ajax/search` + `/ajax/books`, and `bookCoverUrl()` stops
pointing at `/api/cs/get/thumb`. Nothing about how the views *look* changes.

### The sync indicator

A button in the header, between the theme toggle and the gear, in three states:

- **Idle** — a static muted sync glyph. Its tooltip reads "Last synced 4 minutes
  ago", or "Never synced".
- **Syncing** — the glyph spins. Tooltip: what phase it is in and how far
  along ("Syncing covers, 120 of 255").
- **Failed** — the glyph turns destructive-red. The tooltip carries the actual
  error, with the proxy's existing hint when the content server is unreachable
  ("Could not reach the Calibre content server at http://localhost:8080 — start
  it with `calibre-server`…"). The state persists until the next successful
  sync, so a failure at 3am is still visible at 9am.

Clicking it at any time starts a sync. Clicking during a sync does nothing
rather than queueing a second one. The spin is `motion-safe` only; reduced-motion
users get a pulse in opacity instead of rotation, so "something is happening" is
never carried by movement alone. On a phone the indicator stays visible — unlike
the gear, which hides below `sm` — because it is also the error surface.

### Settings

A **Library sync** section in the [settings](settings.md) dialog, under Library:

- **Last synced** — an absolute time, with the relative form beside it.
- **Books** — how many are in `books`, and how many of those are currently
  linked to Calibre, when the two differ ("1,204 books — 3 no longer in
  Calibre").
- **The last error**, in full, when there is one.
- **How often** — a select: every 1, 5, 15, 30 or 60 minutes, or never. Default
  **every 5 minutes**. Applies immediately, no restart.
- **Sync now** — the same full pass as clicking the indicator, with the same
  progress readout.

### When syncs happen

- **At startup**, once the API has a content server URL to talk to.
- **On the interval**, default 5 minutes.
- **When the setup wizard finishes**, or the content server URL changes in
  settings — the new library should appear without waiting out a timer.
- **On demand**, from the indicator or from settings.

With no content server configured, the scheduler stays idle and reports nothing
— an unconfigured app is not a failing one.

## Data model

Everything below is new in `packages/core/src/db.ts`, which owns the schema and
every migration.

### `calibre_books` — the mirror

A verbatim copy of what the content server said, and nothing else. Rows here
*are* deleted when a book leaves Calibre; this table is a cache of the currently
connected library's state, not a history.

Keyed by `calibre_id` because that is what the sweep returns and what deletion
detection compares — but `uuid` is `NOT NULL UNIQUE`, because it is what phase 2
matches on and a duplicate would mean two Grimoire books fighting over one row.

`library_id` is stored for diagnostics only. It is a slug of the library's folder
name, identical across unrelated libraries that happen to share one, so nothing
may branch on it — see "Noticing that the library underneath us changed".

```sql
CREATE TABLE calibre_books (
  calibre_id      INTEGER PRIMARY KEY,      -- Calibre's book id: per-library, sequential, volatile
  uuid            TEXT NOT NULL UNIQUE,     -- Calibre's uuid: the identity phase 2 matches on
  library_id      TEXT NOT NULL,            -- e.g. "Calibre_Library" — a label, NOT identity
  title           TEXT NOT NULL,
  title_sort      TEXT,
  authors         TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
  author_sort     TEXT,
  series          TEXT,
  series_index    REAL,
  tags            TEXT NOT NULL DEFAULT '[]',   -- JSON array
  formats         TEXT NOT NULL DEFAULT '[]',   -- JSON array, uppercased
  publisher       TEXT,
  languages       TEXT NOT NULL DEFAULT '[]',   -- JSON array, e.g. ["eng"]
  identifiers     TEXT NOT NULL DEFAULT '{}',   -- JSON object, e.g. {"isbn":"…"}
  comments        TEXT,                     -- Calibre's description (HTML)
  pages           INTEGER,
  pubdate         TEXT,                     -- ISO 8601; NULL when Calibre says "None"
  timestamp       TEXT,                     -- when Calibre took the book in
  last_modified   TEXT NOT NULL,            -- Calibre's mtime — drives change detection
  has_cover       INTEGER NOT NULL DEFAULT 1,
  raw             TEXT NOT NULL,            -- the whole /ajax/books entry, verbatim
  synced_at       TEXT NOT NULL             -- when we last wrote this row
);

CREATE INDEX calibre_books_last_modified ON calibre_books (last_modified);
CREATE INDEX calibre_books_uuid          ON calibre_books (uuid);
```

JSON in `TEXT` columns rather than child tables. Keeping the mirror one-row-per-book means a sync is one upsert per book
and a failure can't leave half a book behind.

`raw` is the whole payload as JSON. Calibre carries things we don't model yet —
custom columns like this library's `#read`, `format_metadata` with per-file
sizes and mtimes, `identifiers` we may want to search. Keeping the original
means adding a field later is a migration and a re-derive, not a full re-sync of
every book.

### `books` — Grimoire's record

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
  published       TEXT,                     -- ISO 8601 or NULL
  added           TEXT NOT NULL,            -- Calibre's timestamp, else when we created it
  cover_state     TEXT NOT NULL DEFAULT 'none',  -- 'none' | 'cached' | 'missing'
  cover_synced_at TEXT,                     -- the last_modified the cached covers are for
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE INDEX books_title_sort ON books (title_sort);
CREATE INDEX books_source     ON books (source);
CREATE INDEX books_calibre_id ON books (calibre_id);
```

The two Calibre columns are doing different jobs and that is deliberate:

- **`calibre_uuid`** is identity. `UNIQUE`, so two Grimoire books can never claim
  the same Calibre book, and SQLite permits many `NULL`s, so books from a future
  non-Calibre source need no placeholder. Phase 2 joins on it and nothing ever
  clears it.
- **`calibre_id`** is a cached pointer into whichever library is connected right
  now. Deliberately *not* `UNIQUE` and carrying no foreign key: after a library
  switch the same integer legitimately describes a different book, and there is a
  window during a full re-mirror where both the old and new owner of an id exist.
  Uniqueness that matters is enforced on the uuid, where it is actually true.

`calibre_id IS NOT NULL` is therefore the exact test for "in the library right
now" — downloadable, refreshed by sync — and clearing it is what "never remove
books, but we can remove the book id" means mechanically.

No `REFERENCES calibre_books` on either column. An earlier draft used
`ON DELETE SET NULL` to clear the link automatically, which is neat but wrong
here: it would let SQLite's delete order decide identity, and it cannot express
"clear the id, keep the uuid". Phase 2 does the reconcile explicitly instead,
which is also what makes it re-runnable after a crash.

### Sync state — preferences, not a table

Per requirement 4, in the existing key/value store. New `PREF_KEYS` entries:

| Key                    | Holds                                                |
| ---------------------- | ---------------------------------------------------- |
| `sync.lastCompletedAt` | ISO 8601 of the last sync that finished cleanly       |
| `sync.lastAttemptedAt` | ISO 8601 of the last sync that started                |
| `sync.lastStatus`      | `"ok"` \| `"error"`                                   |
| `sync.lastError`       | The failure message, cleared on success               |
| `sync.lastErrorHint`   | The actionable half of it, when there is one           |
| `sync.watermark`       | Newest `last_modified` ingested; the early-stop mark  |
| `sync.intervalMinutes` | `"0"` (never), `"1"`, `"5"` (default), `"15"`, `"30"`, `"60"` |

Live progress ("120 of 255 covers") is in-process state on the scheduler, not a
preference — it changes every few hundred milliseconds and is worthless after a
restart.

### `ratings` — dropped and rebuilt on `books.id`

`ratings.book_id` currently holds a **Calibre** id. Everything Grimoire owns from
here on points at `books.id`, so the table is dropped and recreated rather than
migrated. **Existing stars are discarded.** Grimoire is in heavy development,
nobody's ratings are precious yet, and a mapping step would have to survive a
first sync running against a stopped content server for data that can be
re-entered in a minute.

```sql
DROP TABLE IF EXISTS ratings;

CREATE TABLE ratings (
  user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  book_id    INTEGER NOT NULL REFERENCES books (id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, book_id)
);
```

The real gain is the foreign key. Ratings now cascade off a table Grimoire
controls, so a rating can no longer outlive its book as an orphan row keyed to a
number nothing owns — and because `books` rows are never deleted by sync, a
reader's stars survive a book leaving Calibre, which is what the old keying
could not do.

[Rating a book](rating-a-book.md) needs its "keyed by Calibre book id" wording
updated in the same commit; nothing about the feature's behaviour changes.

## API

| Route                          | Does                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `GET /api/books`               | The library from `books`. Replaces the client's two `/api/cs/ajax` calls.                                  |
| `GET /api/books/:id/cover/:size` | A cached cover (`thumb` \| `card` \| `full`), with ETag and long `Cache-Control`. 404 when not cached.    |
| `GET /api/sync`                | Status: state, last completed, last error, book counts, interval, live progress.                           |
| `POST /api/sync`               | Start a full sync. `202` with the status; if one is already running, returns that status unchanged.         |
| `PUT /api/sync/settings`       | Set `intervalMinutes`, re-arming the timer at once. Rejects anything off the list.                          |
| `PUT /api/preferences`         | Unchanged, but saving a new Calibre URL now kicks a full sync.                                              |

Every payload gets a Zod schema in `packages/core/src/schemas.ts`
([ADR 0009](../adrs/0009-zod-schemas-shared-between-api-and-client.md)):
`BookSchema`, `BooksSchema`, `SyncStatusSchema`. The `LibraryBook` interface
hand-written in `apps/web/src/lib/api.ts` is deleted in favour of
`z.infer<typeof BookSchema>`.

The web client polls `GET /api/sync` every 10 seconds, and every second while a
sync is running, invalidating the `books` query when `lastCompletedAt` moves.

## Acceptance criteria

- [x] A sync mirrors every Calibre book into `calibre_books`, reconciles it into
      `books`, and caches `thumb`, `card` and `full` covers under the data dir.
      *(255 books, 765 cover files, ~13s cold.)*
- [x] The library screen renders entirely from `GET /api/books` and cached
      covers, with the content server stopped. *(Verified by pointing
      `calibre.serverUrl` at a dead port: 255 books and their covers still
      served, and the sync reported why.)*
- [x] A book deleted in Calibre keeps its `books` row, its metadata, its covers
      and its `calibre_uuid`; only `calibre_id` is cleared, and the UI says it is
      no longer in the library.
- [x] A book edited in Calibre shows its new metadata within one interval.
      *(Verified by staling a mirror row and re-syncing. The **cover** half of
      this is by construction — `cover_synced_at < last_modified` — and has not
      been exercised against a real Calibre edit.)*
- [x] An unchanged library costs two requests per tick and writes nothing.
      *(An idle tick is ~225ms, 0 upserts, 0 reconcile, 0 covers.)*
- [x] Pointing Grimoire at a second Calibre library adds that library's books
      rather than overwriting the first library's, even though both use the same
      sequential ids; pointing it back re-links every original book by uuid, with
      no duplicates and no lost ratings. *(255 → 510 books, 255 in library, the
      original rows unlinked with covers and ratings intact.)*
- [x] That holds when both libraries live in a folder named "Calibre Library"
      and so report the same `library_id`: the swap is caught by a `calibre_id`
      reporting a new `uuid`, not by the library name. *(Nothing branches on
      `library_id` at all, so this is structural.)*
- [x] A book deleted and re-added in Calibre onto a recycled id does not
      inherit the previous occupant's Grimoire row.
- [x] Ratings are keyed on `books.id` and cascade with the book; a rating set
      before a book left Calibre is still there afterwards.
- [x] The header indicator turns red on failure with the real error in its
      tooltip, and starts a sync when clicked. The spin is covered by its story;
      a real sync of this library finishes too fast to catch it live.
- [x] The failed state survives until the next successful sync, and reduced-motion
      users get a non-rotating cue.
- [x] Settings shows last-synced time, book count, the last error, a working
      interval select defaulting to 5 minutes, and a Sync now button.
- [x] Two syncs never run at once, and the app never syncs before a content
      server is configured. *(Single-flight by construction — a second caller
      joins the run in flight.)*
- [x] A sync interrupted mid-way (app quit, server unreachable) leaves the
      database consistent and the next sync picks up. *(Reconcile is one
      transaction; a failed sweep leaves the mirror and `books` untouched.)*
- [x] Deleting `<dataDir>/covers/` and syncing restores every cover.
- [x] The indicator has a Storybook story covering all three states, in both
      themes.

## Open questions

- **Cover invalidation is coarse.** `last_modified` moves when *any* field
  changes, so editing a title refetches three images. `format_metadata` carries
  per-file mtimes but nothing similar exists for the cover. Refetching is
  cheap and correct; a stale cover is neither.
- **`raw` costs storage.** Roughly 1–2 KB per book, so a 100k library carries
  ~150 MB it may never read. Worth it while the schema is still moving; worth
  revisiting once nothing new is being derived from it.
- **First sync on a large library is a stampede** — 100k books means 300k cover
  fetches. Six run at a time and the phase reports progress, but there is no
  resume: a first sync killed half way refetches the covers it already has on
  the next full pass (an incremental one will not, since `cover_synced_at` is
  only written per book).
- **Reconcile is all-or-nothing.** One changed book rewrites every row in
  `books`, because the pass has no way to know which rows the change touched.
  Fine at a few thousand books; at a hundred thousand it wants a dirty-set,
  which means the mirror recording what each sweep actually wrote.
- **Multiple Calibre libraries, at once.** Matching on `uuid` means connecting a
  second library is *safe* — nothing is overwritten — but only one is mirrored at
  a time, because every `/api/cs` route uses the content server's default
  library. Browsing two libraries together needs a library selector and
  per-library routes, and `calibre_books` would have to be keyed by
  `(library, calibre_id)` — where "library" cannot be Calibre's `library_id`,
  for the reasons above. A Grimoire-minted library key, seeded on first mirror,
  is the likely answer.
- **The sentinel set is a heuristic, not a proof.** Twenty ids catches a library
  swap essentially always and costs nothing, but a contrived case — two libraries
  sharing their twenty lowest books' uuids, all timestamps below the watermark —
  would slip through until a manual sync. Making it exact means fetching every
  uuid every tick, which is the full sweep the watermark exists to avoid.
- **A second source needs its own key columns.** `calibre_uuid` is concrete
  rather than a generic `source_id`, which is right for one source and will not
  scale to three — and a book that exists in both Calibre *and* hardcover.app
  breaks the assumption that `source` is a single value. That is a
  `book_sources` join table, and it should be decided when the second source is
  real rather than guessed at now.
- **Which Calibre fields become first-class.** `comments`, `publisher`,
  `languages`, `identifiers` and `pages` are mirrored and reconciled but nothing
  renders them until the detail panel exists.
- **Custom columns.** This library's `#read` lives in `user_metadata` and is
  captured in `raw`, but modelling it means deciding whether Grimoire's own read
  state or Calibre's wins — that belongs to a read-status feature, not here.
- **No sync history.** Only the last result is kept. If diagnosing intermittent
  failures needs a trail, that's a `sync_runs` table.
- **Search.** `GET /api/books` returns everything, as `fetchBooks()` does today.
  Server-side search and paging are the same decision as filtering
  ([book list](book-list.md) open questions) and are unblocked, not answered, by
  this.
