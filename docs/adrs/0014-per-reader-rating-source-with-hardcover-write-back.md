---
type: adr
title: Per-reader rating source with Hardcover write-back
description: Each reader chooses whether their stars live in grimoire.db or on their Hardcover account. Choosing Hardcover makes rating in Grimoire write to hardcover.app, the first write to an external source.
tags: [ratings, hardcover, users, sync]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-15 }
---

# Per-reader rating source with Hardcover write-back

## Status

Proposed.

## Context

Grimoire has two places a reader's stars can come from. Local ratings live in
`grimoire.db`, whole stars, set from the shelf
([rating a book](../features/rating-a-book.md)). The Hardcover sync
([ADR 0012](0012-hardcover-as-a-second-source-with-per-reader-tokens.md))
already mirrors each reader's per-book rating from their shelves, in half-star
granularity since Hardcover rates in halves, but nothing displays it.

A reader who lives on Hardcover wants those stars *and* wants to keep rating
from Grimoire's shelf, which is the whole point of the stars being a control.
Displaying Hardcover's number while writing to a local table would mean edits
that never show up. The control would lie.

Until now Grimoire has been read-only against every source: Calibre by decision
([ADR 0005](0005-calibre-content-server-as-the-data-source.md)), Hardcover by
scope. Writing ratings to Hardcover is the first crack in that, and needs
deciding rather than drifting into.

## Decision

**Each reader picks a rating source**, `local` or `hardcover`, stored on
their `users` row (the first per-reader preference), toggled from the settings
Hardcover section. The stars a reader sees and sets follow their source:

- **local.** Today's behaviour. Read and write `ratings` in `grimoire.db`.
  Nothing touches Hardcover.
- **hardcover.** The stars show that reader's Hardcover ratings, and setting
  one **writes to their hardcover.app account** with their own token
  (`update_user_book` on the shelf entry; clearing sends `rating: null`). The
  local mirror row updates in the same request, so the shelf doesn't wait for
  the next sync.

Boundaries that keep the write-back narrow:

- Grimoire rates a book with a Hardcover edition that is **not on the reader's
  shelves** only after the reader confirms, because rating it adds the book to
  their shelves as **Read** (`insert_user_book`, then the rating), matching
  what rating means on hardcover.app itself. No silent shelf additions.
- A **Calibre-only** book, with no Hardcover edition matched, prompts instead.
  Grimoire searches Hardcover's catalogue (their `search` API, with the
  reader's token). Picking the matching book shelves it as **Read**, rates it,
  and links it into the work as a pinned manual grouping, the same merge that
  resolving a duplicate by hand performs, so the matcher never reconsiders it.
  Cancelling rates nothing. Falling back to local silently would scatter one
  reader's ratings across two stores.
- Grimoire writes only `user_books` the reader owns, with the reader's own
  token. Calibre stays read-only ([ADR 0005](0005-calibre-content-server-as-the-data-source.md)).
- Unlinking Hardcover resets the reader's source to `local`. A source that
  can no longer be read or written isn't a choice worth remembering.

**Half stars become the rating unit everywhere.** Hardcover rates in halves, so
the star control must speak halves to show and set those ratings. Local ratings
adopt the same granularity rather than making the control behave differently
per source.

## Consequences

- Ratings stop being one store. Reads and writes branch on
  `users.ratings_source`, and the ratings API grows a source dimension.
- A reader's Hardcover ratings survive and live where the rest of their reading
  life is. Grimoire becomes a real client of their account rather than a
  read-only mirror.
- A failed Hardcover write is a failed rating. The stars roll back, like any
  rating write failing. Grimoire does not queue writes offline.
- Local ratings move from whole to half stars (`REAL` column, with the API
  rejecting anything that isn't a half). Existing whole-star ratings are
  already valid halves.
- The read-state toggle next to this one stays display-only. Wiring it up gets
  its own decision once Grimoire tracks read state at all.
