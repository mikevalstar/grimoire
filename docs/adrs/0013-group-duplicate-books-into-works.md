---
type: adr
title: Group duplicate books into works
description: A book that exists in two sources stays as two rows, grouped under a `works` row; the shelf renders works, and everything Grimoire owns keys on the work rather than on a source's row.
tags: [architecture, data, sync, matching, storage]
status: stable
generated: { by: okq/0.8.0, at: 2026-08-14 }
---

# Group duplicate books into works

## Status

Accepted. Answers the question
[ADR 0011](0011-sync-calibre-into-grimoire-db-and-read-the-library-from-there.md)
and [ADR 0012](0012-hardcover-as-a-second-source-with-per-reader-tokens.md) both
deferred: what happens when one book arrives from two sources.

## Context

[Hardcover sync](../features/hardcover-sync.md) landed deliberately without
matching, so a book in both Calibre and hardcover.app is two rows on the shelf.
That was the right way to get real data in, and it is not a state to keep: the
shelf shows the same book twice, and — the part that actually breaks — rating
"the Calibre one" and rating "the Hardcover one" are two different sets of
stars.

Three shapes were considered.

A **derived group key** on `books` (normalised title, indexed) is the cheapest:
grouping is a `GROUP BY`, no new tables, and a manual override is a locked key.
It gives nowhere to record *why* two books grouped, and nothing stable to hang a
rating on.

A **decision graph** — pairwise edges with a verdict and a confidence, groups as
connected components — is the most expressive, and is where manual resolution
eventually wants to live because a "these are not the same" edge has to survive
the matcher running again. But components must then be materialised into a group
id to key anything on, which is the third option with extra steps.

A **`works` row** is that group id, made first-class.

## Decision

**Every book belongs to a work, and the work is what Grimoire owns data about.**

- `works` is a bare row: an id and a timestamp. Its meaning is entirely "these
  book rows are the same book".
- Every `books` row gets a work on insert — its own, alone. Grouping is only
  ever `UPDATE books SET work_id`, never an insert or a delete, so a book can
  never be in two groups or none.
- **No row is ever merged away or deleted.** Both sources' rows survive intact,
  with their own ids, identifiers and metadata. A work is a statement about
  rows, not a replacement for them.
- **The shelf renders works**, one card per work, with the members' fields
  merged by source precedence and their `sources` unioned — which is what lights
  up more than one mark on a book ([book list](../features/book-list.md)).
- **`books.id` stops being the id the API speaks.** `Book.id` in every payload
  is now a *work* id: it is what a rating keys on, what a cover URL names, and
  what the client holds. The member row ids stay server-side.
- **Ratings re-key onto the work.** `ratings.work_id` replaces
  `ratings.book_id`, cascading off `works`.

Matching itself — how books are proposed for a work — is
[book matching](../features/book-matching.md), and is deliberately a separate
concern: the grouping is the same whether a human or a heuristic decided it.

## Consequences

One book reads as one book. A rating survives its book gaining a second source,
because the work id does not change when a member joins it — which is the whole
reason the group is a row rather than a computed key.

**Ratings move for the second time.** [ADR 0011](0011-sync-calibre-into-grimoire-db-and-read-the-library-from-there.md)
re-keyed them off Calibre ids and had to drop them, because `books` was empty at
migration time. This one loses nothing: every book already has a singleton work,
so the migration is `work_id = the work of the book this rating pointed at`.
That it is happening again is the argument for keying on the work and not on
whatever a source currently calls a book.

**A cover is now indirect.** Cover files are still named by the member's
`books.id`, so `/api/books/:id/cover/:size` resolves a work to whichever member
actually has a cached file. That indirection is the price of the browser never
learning a source's row id.

**Merged metadata needs a precedence rule**, and precedence is a judgement:
Calibre wins where it knows more (the file, its formats, the title you gave it),
Hardcover fills what Calibre leaves empty (descriptions, page counts, covers).
Field-level manual overrides are not modelled and will want a table of their own.

**A wrong grouping is now a thing that can happen**, where before there were only
duplicates. That is a real regression in the failure mode — two books wrongly
declared the same is worse than one book listed twice — and it is why the
automatic matcher is deliberately narrow, why `books.work_pinned` exists, and
why nothing splits a work automatically.

Reverting means pointing the shelf back at `books` rows; the works table can be
left in place, ignored, with ratings re-keyed back through it.
