---
type: feature
title: Rating a book
description: Setting your own star rating from the shelf — hover the stars in either view and click one. Ratings are per-reader and stored in grimoire.db; Calibre's own ratings are never shown and never written to.
tags: [frontend, ui, library, users, ratings]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-11 }
---

# Rating a book

## Summary

The stars on a book are not a read-out. Point at them in either view of the
[book list](book-list.md) and they become a control: hovering previews a rating,
clicking commits it, clicking the star you already gave clears it. The rating is
*yours* — the first per-reader data Grimoire stores.

## Motivation

Rating is the smallest act of organizing a library and the one people do most:
you finish a book, you have an opinion, and it should cost one click from the
shelf you are already looking at. Sending the reader out to Calibre to record it
is the round trip that means the rating never gets recorded.

The stars were already drawn on every card and row in the user accent, because
[the shell](application-shell.md) reserves that accent for *your* state rather
than the library's. That promise was unkept — they showed Calibre's number and
could not be changed. This makes them mean what they already looked like they
meant.

## Behavior

### Where the rating lives

Per reader in `grimoire.db`
([ADR 0006](../adrs/0006-grimoire-owned-sqlite-for-supplemental-data.md)), keyed
by reader and by the **work** — Grimoire's own idea of the book, not Calibre's
row and not a source's
([ADR 0013](../adrs/0013-group-duplicate-books-into-works.md), refining
[ADR 0011](../adrs/0011-sync-calibre-into-grimoire-db-and-read-the-library-from-there.md)).
So a rating cannot outlive its book as an orphan, and does not split in two when
the same book arrives from a second source: rating a book you own in Calibre and
also track on hardcover.app is one set of stars, before or after the two are
grouped. Scoped by the `X-Grimoire-User` header
([ADR 0008](../adrs/0008-multiple-users-without-authentication.md)). **These are
the first user-scoped routes in Grimoire**, and so the first real use of that
header: a request without it is refused, never a silent default to reader one.

Nothing is written back to Calibre. Grimoire stays read-only against it
([ADR 0005](../adrs/0005-calibre-content-server-as-the-data-source.md)) — and a
content server refuses anonymous writes anyway, so depending on how the reader
launched Calibre for whether they can rate a book is not a feature.

### Only your own stars

Calibre's rating is **not** shown and is not a fallback. A book you have not
rated is blank, whatever Calibre thinks of it.

Borrowing Calibre's number into the user accent would say "you rated this four"
about a book you had never opened — and the lie would be invisible, because a
borrowed rating and a real one look identical. Blank is honest. The price is
that ratings already in the Calibre library are not adopted, and there is no
import; the book model carries no `rating` field at all, so there is nothing for
a future view to accidentally fall back to.

### The interaction

The stars are a hover affordance held to the same two rules as everything else
on the shelf ([book list](book-list.md)): nothing appears on hover that a
keyboard can't reach, and hover never moves anything a click is aimed at.

- **At rest** it looks like the read-only stars always did — the earned stars
  and nothing else. The empty stars and the clear button are *transparent, not
  absent*, so revealing them moves nothing.
- **On hover or focus** the empty stars fade in and the clear button appears,
  which is the whole signal that these are yours to set.
- **Pointing at a star** previews that rating; leaving without clicking restores
  the committed value.
- **Clicking** commits, and the star bursts. The write is optimistic and
  otherwise silent, so this is the only acknowledgement that the click landed —
  and rating a book you liked should feel like something. Clearing gets no
  burst; there is nothing to celebrate about taking a star back. Clicking the
  star that already is your rating clears it, the Goodreads convention, kept as
  a fast path.
- **Clearing** has its own visible control after the stars, previewing the clear
  on hover. The click-the-current-star toggle does the same job, but only for
  someone who already knows it exists; this is the one you can find.
- **Keyboard** — a real radio group: tab reaches it, arrows move through the
  values, Enter or Space commits, every star has its own accessible name, and
  the preview follows focus exactly as it follows the pointer.
- **Reduced motion** — the fade, the pop and the burst are all `motion-safe`.
  The rating still commits and the stars still fill; nothing moves.

Whole stars only. Calibre can store half stars; Grimoire's column is an integer
1–5, and since Calibre's ratings are never read there is nothing to round.

### Rating from either view

Both views get the same control — under the series line in the grid, in the
rating column in the table, where the stars swallow the click that would
otherwise open the book. Making the stars a target is what forced cards to a
fixed height ([book list](book-list.md)): they have to land in the same place on
every card to be findable, so the row of stars reads straight across the shelf
instead of stepping up and down with whichever books happen to be in a series.

### Committing

The write is optimistic — the stars change under the pointer and the request
goes out behind them, because waiting a round trip to see your own click is what
makes a rating control feel broken. A failed write rolls the stars back.

Ratings are fetched once per reader as a map of book id to rating rather than
per book. Switching the current reader in [settings](settings.md) re-fetches, so
the shelf shows the new reader's ratings without a reload.

## API

`GET /api/ratings` returns every rating this reader has set; unrated books are
absent, not zero. `PUT /api/ratings/:bookId` sets one, and zero deletes it. Both
require `X-Grimoire-User`, and both payloads are Zod schemas shared by API and
client ([ADR 0009](../adrs/0009-zod-schemas-shared-between-api-and-client.md)).

## Acceptance criteria

- [ ] Hovering the stars in either view previews a rating, and clicking one
      commits it.
- [ ] Clicking the star that matches the current rating clears it.
- [ ] An unrated book shows a hollow, hoverable control rather than nothing, and
      rating a book never changes the height of its card or row.
- [ ] Committing plays a burst; clearing does not, and neither animates under
      reduced motion.
- [ ] Cards are the same height whether or not the book is in a series, so the
      stars line up across the shelf.
- [ ] The control is a keyboard-reachable radio group with per-star accessible
      names, and previews on focus as it does on hover.
- [ ] A rating can be cleared from a visible control, not only by knowing to
      click the current star again.
- [ ] Ratings are stored per reader and survive a reload; two readers can rate
      the same book differently, and switching reader switches the stars on
      screen.
- [ ] A book the reader hasn't rated shows no stars, whatever Calibre's rating
      for it is.
- [ ] Nothing is written to the Calibre content server.
- [ ] A rating route without `X-Grimoire-User` is refused rather than defaulting
      to a reader.
- [ ] The write is optimistic and rolls back on failure.
- [ ] The interactive control has a Storybook story, in both themes.

## Open questions

- **Where the join happens.**
  [ADR 0006](../adrs/0006-grimoire-owned-sqlite-for-supplemental-data.md) says
  Grimoire and Calibre data should be joined server-side so the frontend
  receives one shape; ratings are still looked up in the client. Now that
  [sync](calibre-sync.md) gives us our own `books` table, folding them into
  `GET /api/books` is worth doing before the second piece of per-book
  supplemental data lands.
- **The ratings already in Calibre** are permanently invisible with no way to
  adopt one. A one-off import for the current reader is the obvious answer; the
  part that needs a decision is guessing whose ratings those were.
- **Half stars.** Calibre can express them and this cannot; changing that is a
  migration, not just a hit target on each star half.
- **Sorting and filtering by rating.** "My 5-star books" is the obvious first
  filter, and it needs the rating sortable server-side — the same argument for
  moving the join.
- **Deleting a reader.** [Settings](settings.md) still can't remove one, and
  ratings are exactly the per-reader data whose fate that question was waiting
  on. The rows cascade, so the answer is available when the UI wants it.
