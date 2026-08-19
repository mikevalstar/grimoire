---
type: feature
title: Settings
description: One sectioned dialog behind the header's gear. Covers the Calibre connection and sync, each reader's Hardcover account with its sync stats and source toggles, the readers themselves, and duplicate matching.
tags: [frontend, ui, configuration, users]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-11 }
---

# Settings

## Summary

The gear in the header opens one dialog with everything that can be changed
after setup. The dialog is a fixed size. A section list runs down the left:
Calibre, Hardcover, Readers, Duplicates. The chosen section's content fills the
right, so each concern gets room without the whole thing becoming one long
scroll.

## Motivation

The [setup wizard](first-run-setup-wizard.md) asks its questions once and then
gets out of the way, which leaves no way to answer them differently later. A
content server moves to another port. A reader joins the household after setup.
Settings is where those answers live for the rest of the app's life.

The first version was one scroll of stacked headings, which stopped fitting
once Hardcover brought per-reader connections, sync stats and source toggles.
Sections behind a sidebar keep each pane small while staying one dialog, still
less navigation than a settings *route* would be. When a section outgrows a
pane, that decision gets revisited.

## Behavior

A regular dialog. Escape, the close button and clicking outside all dismiss it.
The sidebar switches sections; the dialog keeps one size so switching doesn't
jump the layout. Callers can open it on a particular section. The header's
avatar menu opens straight to Readers.

### Calibre

The connection and the sync, together, since one is the health of the other:

- The content server URL, with the same server-side **Test** probe the wizard
  uses ([ADR 0005](../adrs/0005-calibre-content-server-as-the-data-source.md)),
  which reports the book count on success. **Save** lives next to the field and
  is the only deferred write in the dialog. The API resolves the proxy target
  per request, so the new server is live with no restart.
- Sync stats, as a small tile row: books still in Calibre, books Grimoire
  tracks in total, and books that have left Calibre when the two differ. The
  row also shows when the last sync completed and when one was last attempted
  ([calibre-sync](calibre-sync.md)).
- The auto-sync interval (applies immediately), a **Sync now** button that
  reports progress while running, and the last error in full if there was one.

### Hardcover

One card per reader, because the token is a person, not an instance-wide
setting ([ADR 0012](../adrs/0012-hardcover-as-a-second-source-with-per-reader-tokens.md),
[Hardcover connection](hardcover-connection.md)). A linked reader's card shows:

- The Hardcover username the stored token belongs to, with **Sync now**,
  **Test** and **Unlink**.
- Sync stats: how many books their shelves hold, the breakdown by reading
  status, when it last synced, and the last sync error if any. The breakdown is
  the proof that reading *state* came over, not just titles
  ([Hardcover sync](hardcover-sync.md)).
- Two source toggles, deciding which truth wins where Grimoire and Hardcover
  both have an answer:
  - **Stars from Hardcover.** This reader's rating source
    ([ADR 0014](../adrs/0014-per-reader-rating-source-with-hardcover-write-back.md)).
    On, the shelf shows their Hardcover ratings and rating a book writes to
    their hardcover.app account; off, stars live in `grimoire.db`
    ([rating a book](rating-a-book.md)). On by default, stored on the reader,
    applied immediately, and reset to local by unlinking.
  - **Read state from Hardcover.** This reader's read-state source
    ([marking a book read](marking-a-book-read.md)). On, the cover's corner
    check reads and writes their Hardcover shelves; off, read state lives in
    `grimoire.db`. Stored on the reader, applied immediately; a reader with
    no linked account is always local.

An unlinked reader's card is the token form: paste, test, save. It points at
where a token comes from.

Below the cards sits **Book content from Hardcover**, four switches deciding
which of Hardcover's answers about a book Grimoire shows instead of Calibre's.

- **About.** Hardcover's description in place of Calibre's comments.
- **Tags.** Hardcover's genres and tags in place of Calibre's.
- **Moods.** Hardcover's mood tags as their own section. Calibre has no
  equivalent for them.
- **Series.** The series [sync](hardcover-sync.md) pulled from Hardcover in
  place of Calibre's series line
  ([ADR 0019](../adrs/0019-series-as-records-with-a-primary-per-work.md)).

All four are on by default, including for libraries that predate them: the
absent key reads as on, so nothing has to be migrated or re-answered. These are
instance-wide preferences rather than per-reader ones. Unlike the source
toggles above, they say what a *book* looks like, not whose account an answer
comes from. They live in the `preferences` table under `hardcover.about`,
`hardcover.tags`, `hardcover.moods` and `hardcover.series`. Each applies the
moment it is flipped. The first three fetch their content with the *reading*
reader's token, so a reader with no linked account keeps Calibre's text
whatever the switches say.

**Series is the odd one of the four.** Grimoire fetches the other three live
for an open panel and never stores them. A series has to be stored, because
sorting and grouping the shelf by it cannot wait on a request per book. So
flipping this one re-decides which stored series a work shows rather than
changing what gets asked for, and turning it off deletes nothing. Calibre's
series line comes back. A series set by hand
([setting a series from Hardcover](setting-a-series-from-hardcover.md)) outranks
the switch in both positions.

### Readers

Everyone in `grimoire.db`
([ADR 0008](../adrs/0008-multiple-users-without-authentication.md)), with the
reader on this device marked. **Add a reader** uses the same name and colour
picker the wizard does, writing immediately.

*Switching* the device's reader is not here any more. It moved to the header
avatar menu ([application shell](application-shell.md)), where it is one click
instead of a trip through settings.

### Duplicates

The library-wide **review queue**
([resolving duplicates](resolving-duplicates.md)): every pair the automatic
pass refused and nobody has answered. Each row carries the two books, the
reason, and the panel's two answers, **Same book** and **Not the same**.
Above it, the **Find duplicates** button runs a matching pass by hand
([book matching](book-matching.md)) and reports what it grouped and what it
left for the queue below. Matching also runs on its own at startup and after
any sync that changed something, so this button is a "look again".

### What saves when

**Save** in the Calibre section commits the content server URL only. Everything
else applies the moment you do it: adding a reader, linking or unlinking
Hardcover, changing the sync interval, pressing either Sync now. There is
nothing to review, and making it wait behind a Save would only invite closing
the dialog and losing the change.

## Acceptance criteria

- [ ] The header gear opens the dialog; Escape, the close button and an outside
      click all close it; the sidebar switches between the four sections.
- [ ] The Calibre section tests and saves the URL, shows the sync stat tiles,
      the interval select, Sync now, and any sync error.
- [ ] The Hardcover section shows a card per reader: link/test/unlink and the
      token form for the unlinked, stats and the two source toggles for the
      linked.
- [x] The Hardcover section offers the three book-content switches, they read
      as on where nothing was ever saved, and flipping one changes what the
      details panel shows without a reload.
- [ ] The Readers section lists everyone, marks this device's reader, and adds
      a reader with a colour.
- [ ] Find duplicates runs a matching pass and reports what it grouped and what
      it left alone.
- [ ] The dialog can be opened on a named section, and the avatar menu's "Add
      reader" lands on Readers.
- [ ] The dialog has a Storybook story per section.

## Open questions

- No rename or remove for readers, so a typo made during setup still survives.
- The theme toggle stays in the header rather than moving in here; if settings
  grows a general "appearance" section, revisit that decision.
- Nothing here explains that the header avatar is not a login. The wording may
  need to work harder once a Grimoire instance is routinely shared over a LAN.
