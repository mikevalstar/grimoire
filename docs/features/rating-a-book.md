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

The stars on a book are no longer a read-out. Point at them in either view of
the [book list](book-list.md) and they become a control: hovering fills to the
star under the pointer, clicking commits that rating, and clicking the star you
already gave clears it. The rating is *yours* — the first per-reader data
Grimoire stores.

## Motivation

Rating is the smallest possible act of organizing a library, and the one people
do most: you finish a book, you have an opinion, and it should cost one click
from the shelf you are already looking at. Sending the reader out to Calibre to
record it is the kind of round trip that means the rating never gets recorded.

The stars were already drawn on every card and row, in the user accent, because
[the shell](application-shell.md) reserves that accent for *your* state rather
than the library's. That promise was unkept — the stars showed Calibre's number
and could not be changed. This makes them mean what they already looked like
they meant.

## Behavior

### Where the rating lives

Per reader, in `grimoire.db`
([ADR 0006](../adrs/0006-grimoire-owned-sqlite-for-supplemental-data.md)), keyed
by `(user_id, books.id)` — Grimoire's own book id, not Calibre's, so a rating
cannot outlive its book as an orphan
([ADR 0011](../adrs/0011-sync-calibre-into-grimoire-db-and-read-the-library-from-there.md))
— and scoped by the `X-Grimoire-User` header
([ADR 0008](../adrs/0008-multiple-users-without-authentication.md), which names
rating as per-reader data in as many words). **This is the first route in
Grimoire that is user-scoped**, and so the first real use of that header: a
request without it is a 400 on the rating routes, never a silent default to
reader one.

Nothing is written back to Calibre. Grimoire stays read-only against it
([ADR 0005](../adrs/0005-calibre-content-server-as-the-data-source.md)) — and
in practice a content server refuses anyway, answering `POST /cdb/set-fields/…`
with *"Anonymous users are not allowed to make changes"* unless it was started
with `--enable-local-write`. Depending on how the reader launched Calibre for
whether they can rate a book is not a feature.

### Only your own stars

Calibre's rating is **not** shown, and is not a fallback. A book you have not
rated is blank, whatever Calibre thinks of it.

The stars sit in the user accent, which the [shell](application-shell.md)
reserves for your own state. Borrowing Calibre's number into that accent would
say "you rated this four" about a book you had never opened — and worse, the
lie would be invisible, because a borrowed rating and a real one looked
identical. Blank is honest.

This is not free: the 35 books already rated in this library lost their stars
the day this shipped, and there is no import. That is the price of the stars
meaning exactly one thing. `LibraryBook` therefore carries no `rating` field at
all, so there is nothing for a future view to accidentally fall back to.

### The interaction

The stars are a hover affordance held to the same two rules as the
[download button](book-list.md): nothing appears on hover that a keyboard can't
reach, and hover never moves anything a click is aimed at.

- **At rest** — it looks exactly like the read-only stars always did: the
  earned stars and nothing else, and nothing at all on an unrated book. The
  empty stars and the clear button are *transparent, not absent*, so the
  control still occupies its full width and revealing it moves nothing.
- **On hover or focus** — the empty stars fade in outlined and the clear button
  appears, which is the whole signal that these are yours to set. Nothing about
  the layout changes; only what is visible does.
- **Pointing at a star** — the group previews that rating: stars up to and
  including the one under the pointer fill in the user accent, the rest hollow.
  Leaving without clicking restores the committed value.
- **Clicking a star** — commits that rating, and the star bursts: six short
  rays fly outward while the star itself pops once. The write is optimistic and
  otherwise silent, so this is the only acknowledgement that the click landed —
  and rating a book you liked should feel like something. Clearing a rating
  gets no burst; there is nothing to celebrate about taking a star back.
  Clicking the star that already *is* your rating also clears it — the
  Goodreads convention, kept as a fast path.
- **Clearing** — a × sits after the stars, present whenever there is a rating
  to remove, revealed with the rest of the control. Pointing at it previews the
  clear: the stars empty out to show what you would be left with. The toggle
  above does the same job, but only for someone who already knows it exists;
  the × is the one you can find. Its width is reserved whether or not a rating
  exists, so earning one doesn't shove the row sideways.
- **Keyboard** — the group is a real radio group. Tab reaches it, arrow keys
  move through the five values, Enter or Space commits, and every star carries
  its own accessible name ("Rate 3 stars"). The preview follows focus exactly
  as it follows the pointer.
- **Reduced motion** — the fade, the pop and the burst are all `motion-safe`.
  The rating still commits and the stars still fill; nothing moves.

Whole stars only. Calibre can store half stars; Grimoire's own column is
integer 1–5, and since Calibre's ratings are never read there is nothing to
round.

### Rating from either view

Both views get the same control. In the covers grid it sits under the series
line where the read-only stars were; in the table it is the rating column. In
the table the stars swallow the click that would otherwise open the book, so
rating a row never also opens it.

Making the stars a target changed what the grid owes them: they have to be
*findable*, which means landing in the same place on every card. So a card now
spends a fixed number of lines on metadata — two for the title, one each for
author and series, reserved whether or not the book has them — and pins the
stars to the bottom of the card. A standalone book and the third volume of a
series are the same height, and the row of stars reads straight across the
shelf instead of stepping up and down with whichever books happen to be in a
series. The reservation is in `lh` units, so it follows the type rather than a
pixel height that a font change would break.

### Committing

The write is optimistic: the stars change under the pointer immediately and the
`PUT` goes out behind it, because waiting a round trip to see your own click is
the thing that makes a rating control feel broken. A failed write rolls the
stars back to what they were.

Ratings are fetched once per reader as a map of book id to rating, rather than
per book, and the views look each book up in it. Switching the current reader
in [settings](settings.md) re-fetches, so the shelf shows the new reader's
ratings without a reload.

## API

Both routes require `X-Grimoire-User`.

- `GET /api/ratings` — every rating this reader has set, as
  `{ "<bookId>": <1-5> }`. Books they have not rated are absent, not zero.
- `PUT /api/ratings/:bookId` — body `{ "rating": 0-5 }`. Zero deletes the row.
  Answers with the stored rating.

Both payloads are Zod schemas in `packages/core/src/schemas.ts`, shared by the
API and the client ([ADR 0009](../adrs/0009-zod-schemas-shared-between-api-and-client.md)).

## Acceptance criteria

- [ ] Hovering the stars in either view previews a rating, and clicking one
      commits it.
- [ ] Clicking the star that matches the current rating clears it back to
      unrated.
- [ ] An unrated book shows a hollow, hoverable control rather than nothing,
      and rating a book never changes the height of its card or row.
- [ ] Committing a rating plays a burst on the clicked star; clearing one does
      not, and neither animates under reduced motion.
- [ ] Cards in the covers grid are the same height whether or not the book is
      in a series, so the stars line up across the shelf.
- [ ] The control is a keyboard-reachable radio group with per-star accessible
      names, and previews on focus as it does on hover.
- [ ] Ratings are stored per reader in `grimoire.db` and survive a reload.
- [ ] Two readers can rate the same book differently, and switching the current
      reader switches the ratings on screen.
- [ ] A book the reader hasn't rated shows no stars, whatever Calibre's own
      rating for it is.
- [ ] The stars look like a plain read-out until the pointer or focus enters
      them, and revealing the control shifts nothing.
- [ ] A rating can be cleared from a visible control, not only by knowing to
      click the current star again.
- [ ] Nothing is written to the Calibre content server.
- [ ] A rating route without `X-Grimoire-User` is refused rather than defaulting
      to a reader.
- [ ] The write is optimistic and rolls back on failure.
- [ ] The interactive control has a Storybook story, in both themes.

## Open questions

- **Where the join happens.**
  [ADR 0006](../adrs/0006-grimoire-owned-sqlite-for-supplemental-data.md) says
  Grimoire and Calibre data should be joined server-side so the frontend
  receives one shape. Ratings are looked up in the client instead, because the
  book list is already assembled client-side out of two raw `/api/cs` calls.
  The right fix is a real `GET /api/books` that does the proxying, joining and
  validating server-side — worth doing before the second piece of per-book
  supplemental data lands, not after.
- **The ratings already in Calibre.** Dropping the fallback means every rating
  in the Calibre library is now invisible, permanently, with no way to adopt
  one. A one-off "import my Calibre ratings" for the current reader is the
  obvious answer and is maybe twenty lines — the data is right there in
  `/ajax/books`. It is not built because nobody has asked for it yet, and
  guessing whose ratings those were is the part that needs a decision.
- **Half stars.** Calibre can express them and this cannot. The column is
  `INTEGER` with a `CHECK (rating BETWEEN 1 AND 5)`, so this one is a
  migration, not just a hit target on each star half.
- **Sorting and filtering by rating.** The toolbar's filter region is still
  empty, and "my 5-star books" is the obvious first filter. It needs the rating
  to be sortable server-side, which is the same argument for moving the join.
- **Deleting a reader.** [Settings](settings.md) still can't remove one, and
  ratings are now exactly the per-reader data whose fate that question was
  waiting on. The rows are `ON DELETE CASCADE`, so the answer is available when
  the UI wants it.
- ~~**Books that leave Calibre.**~~ Closed by
  [Calibre sync](calibre-sync.md): ratings hang off a `books` row that sync never
  deletes, with a foreign key that cascades, so the orphan risk
  [ADR 0006](../adrs/0006-grimoire-owned-sqlite-for-supplemental-data.md) named
  no longer applies. Removing a *reader* still takes their ratings with them,
  which is the intended behaviour.
