---
type: adr
title: Sync Calibre into grimoire.db and read the library from there
description: A background job mirrors the Calibre content server into grimoire.db and caches covers on disk; every library screen reads Grimoire's own tables, with Calibre's uuid as book identity.
tags: [architecture, data, calibre, sync, storage]
status: stable
generated: { by: okq/0.8.0, at: 2026-08-11 }
---

# Sync Calibre into grimoire.db and read the library from there

## Status

Accepted. Refines [ADR 0006](0006-grimoire-owned-sqlite-for-supplemental-data.md),
which anticipated a synced copy without deciding that it becomes the read path.
[ADR 0005](0005-calibre-content-server-as-the-data-source.md) stands unchanged:
Calibre is still reached only over HTTP, and is still authoritative.

## Context

Until now the library screen was a live view of the content server: two
`/api/cs/ajax` round trips per load and one proxied request per cover
([book list](../features/book-list.md)). That has three costs we are about to
start paying in full.

Sorting and filtering a library happens *somewhere*. Over HTTP, against
Calibre's query vocabulary, it means refetching — and we inherit that vocabulary
whether or not it can express what we want. Second, the app shows nothing when
`calibre-server` is not running, which is a desktop app someone quits. Third,
and decisive: shelves, reading progress, and books from other sources
(hardcover.app) all need a book record Grimoire controls, with an identity that
outlives a book being removed from Calibre. Ratings keyed on Calibre ids already
demonstrate the failure — a deleted book orphans someone's stars.

ADR 0006 established that Grimoire may keep synced copies "where a local copy
buys something real". Whether the UI then reads the copy instead of the origin
was left open, and it is the decision that actually changes the architecture.

## Decision

A background sync mirrors Calibre into `grimoire.db`, and every library surface
reads from `grimoire.db`. Four parts:

**Two tables, not one.** `calibre_books` is a verbatim mirror of the connected
library — rows appear and disappear with Calibre's. `books` is Grimoire's own
record, written by reconciling the mirror into it. Sync inserts and updates
`books` rows and **never deletes one**; a book that leaves Calibre keeps its row
and loses only its link. Grimoire-owned data hangs off `books.id`, so it is
never keyed to something Calibre can revoke.

**Identity is Calibre's `uuid`, not its book id.** Calibre ids are small
sequential integers scoped to one library, so id 42 names a different book in
every library. `books.calibre_uuid` is the durable key and is never cleared;
`books.calibre_id` is a volatile pointer into whichever library is connected,
cleared when the book is absent. Connecting a second library therefore adds
books rather than overwriting them, and reconnecting the first re-links every
row.

**Covers are cached on disk**, at three fixed sizes, under the data dir
([ADR 0007](0007-user-data-and-asset-storage-location.md)) and named by the
*Grimoire* book id — so a book keeps its cover after leaving Calibre, and the
browser never learns that a Calibre id exists.

**The scheduler lives in `packages/api`**, so desktop, hosted server and
`bun dev` each get exactly one syncer regardless of how many clients are
connected, and all three keep speaking the same HTTP API
([ADR 0002](0002-one-http-api-three-delivery-targets.md)). `/api/cs` remains,
for downloads and for the sync job itself.

Design and schema are in [Calibre sync](../features/calibre-sync.md).

## Consequences

The library renders from local SQLite and local files, so it is fast, sortable
and filterable on our terms, and it works with Calibre stopped. Features that
need a book record Grimoire owns are unblocked, and a second book source becomes
an additional writer into `books` rather than a rewrite.

The costs are the ones a cache always has, plus two specific to this shape.
**Staleness is now a real state**: the UI can be wrong for up to one sync
interval, which is why sync status is a visible, first-class piece of UI rather
than a log line. **Disk usage grows with the library** — three JPEGs per book
plus the mirror — where before it was zero. Sync itself is code that must handle
partial failure, and the first sync of a large library is a long one before the
app is useful.

We also accept a deliberate duplication: the same metadata exists in
`calibre_books` and in `books`. Collapsing them would save space and lose the
distinction the whole design rests on — what Calibre said, versus what Grimoire
has decided to keep.

Reverting is cheap: the API keeps the proxy, and the client would go back to
calling `/api/cs/ajax`. Deleting `grimoire.db` and the cover cache costs a
re-sync and any Grimoire-owned data, which is what
[ADR 0007](0007-user-data-and-asset-storage-location.md) already promised.
