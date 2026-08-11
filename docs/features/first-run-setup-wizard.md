---
type: feature
title: First-run setup wizard
description: The welcome flow shown the first time Grimoire opens — introduce the app, connect the Calibre content server, and add the people who will read from this library.
tags: [frontend, ui, onboarding, users, configuration]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-11 }
---

# First-run setup wizard

## Summary

The first time Grimoire opens it takes over the window with a short, stepped
wizard: a welcome, the Calibre content server connection, and the readers who
share this library. When it finishes, preferences are saved, the readers exist
as rows in `grimoire.db`, and the app is usable.

This is **not** the [settings dialog](settings.md). The wizard runs once (and
again after a [preferences version bump](#re-running-the-wizard)), asks only for
what is needed to start, and is written to welcome someone who has just
installed the app. Settings is where the same values get changed later.

## Motivation

Grimoire cannot show anything at all until it knows where the Calibre content
server is ([ADR 0005](../adrs/0005-calibre-content-server-as-the-data-source.md)),
so *some* gate has to exist before the library. Given that we have to interrupt
the user anyway, first run is also the only moment where asking "who reads
here?" is natural rather than a chore — and per-user data is separated from day
one ([ADR 0008](../adrs/0008-multiple-users-without-authentication.md)), so the
question has to be answered before there is anything to attach to a person.

The first screen of a self-hosted app is usually a form. Grimoire's is a
welcome: it says what the app does and where its data comes from, and only then
asks for a URL.

## Behavior

Four steps in one non-dismissable modal over the ambient backdrop. A step rail
(dots plus "Step 2 of 4") shows position; **Back** returns to any earlier step
with the answers intact. There is no Escape, no click-outside, and no close
button — leaving mid-setup would land on an app that cannot render.

### 1 — Welcome

One line on what Grimoire is, three one-line points — where the data comes from,
multiple readers, desktop and browser — and a **Get started** button. Copy stays
short and plain throughout the wizard; this is a setup screen, not a pitch.

### 2 — Connect to Calibre

The content server URL, defaulting to `http://localhost:8080`, with the
instructions for turning the server on in Calibre (Preferences → Sharing over
the net).

**Test** probes the URL through `POST /api/calibre/test` — server-side, so no
CORS — and reports the book count on success. **Continue** tests first if the
URL has not been tested yet: a successful probe advances, a failed one shows the
error and turns the button into **Continue anyway**, so a user whose server is
merely not running yet is warned but never trapped. The probed book count is
carried forward and shown again on the final step.

### 3 — Who's reading?

The step that makes the library feel like it belongs to someone. Each reader is
a name and a colour:

- **Name** — required, trimmed, at most 40 characters, and unique
  case-insensitively. The first reader's name field is focused on arrival.
- **Colour** — a swatch grid of **24 fixed colours**
  (`USER_COLORS` in `packages/core/src/types.ts`). A new reader is pre-assigned
  the first colour nobody has taken, so a household that just presses Enter
  four times still gets four distinguishable people.

**Add reader** appends to a list rendered as avatar chips — initials on the
chosen colour, name, and a remove button. A name left in the field when Finish
is pressed is added rather than lost. The library must end up with at least one
reader, so a first run cannot finish empty; a re-run can, since the readers from
last time are already there.

Readers are held in local state and written only when the wizard finishes, so
backing out leaves no half-made people. Anyone already in the database — from a
previous run, or from a finish that failed partway — is listed as a locked row
that cannot be removed here, and a retry creates only the ones still missing.

**Reader colours are their own plane.** The shell's duotone rule — indigo marks
what is yours, amber is reserved for other readers' data
([Application shell](application-shell.md)) — governs library data marks.
A reader colour identifies a *person*, and only ever appears on that person's
avatar or chip. It never colours a rating, a progress bar, or a selection.

### 4 — You're all set

Finishing writes, in order: one `POST /api/users` per new reader, then a single
`PUT /api/preferences` carrying the content server URL and the new preferences
version. Splitting it this way keeps the version stamp last — if reader creation
fails, setup has not been marked complete and the wizard is still there on
reload, with the error shown against the reader that failed.

The final step is a confirmation, not a form: the book count found on the
Calibre server, the readers as chips, and **Open library**. The first
reader created becomes the current user (`grimoire.user` in `localStorage` —
a convenience, not a credential), so the header avatar shows a real person
immediately.

### Re-running the wizard

The gate is `preferences.version` versus `PREFERENCES_VERSION`
(`packages/core/src/types.ts`): a fresh database seeds `"0"` and the wizard runs
while the stored value is lower. Bumping the constant sends existing installs
back through it, with previously-saved answers pre-filled and existing readers
listed as locked. Adding a step means bumping that constant in the same commit.

To exercise a genuine first run, wipe the database: `bun run db:wipe` deletes
`grimoire.db` (and its WAL sidecars) from the data dir, honouring
`GRIMOIRE_DATA_DIR` ([ADR 0007](../adrs/0007-user-data-and-asset-storage-location.md)),
and prints what it removed.

## Data

Readers are rows in Grimoire's own SQLite database
([ADR 0006](../adrs/0006-grimoire-owned-sqlite-for-supplemental-data.md)),
created through `UsersStore` in `packages/core`:

```sql
CREATE TABLE users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL COLLATE NOCASE UNIQUE,
  color      TEXT NOT NULL,
  created_at TEXT NOT NULL
)
```

The API surface is `GET /api/users` and `POST /api/users`; a duplicate name
answers `409`. Adding a reader later happens in [Settings](settings.md);
renaming and deleting are not built anywhere yet. Payload shapes are Zod schemas shared by API and client
([ADR 0009](../adrs/0009-zod-schemas-shared-between-api-and-client.md)); the
stored `color` is a colour **id** (`"indigo"`), never a hex value, so the
palette can be restyled without a migration.

## Acceptance criteria

- [x] The wizard gates the whole app while `preferences.version` is below
      `PREFERENCES_VERSION`, and cannot be dismissed.
- [x] Four steps — welcome, Calibre, readers, done — with a visible position
      indicator and working Back.
- [x] Continue tests an untested URL, and a failed probe warns without trapping
      the user.
- [x] A first run cannot finish with no readers; names are trimmed,
      length-capped and rejected as duplicates case-insensitively.
- [x] 24 colours, pre-assigned to the first free one, stored as ids in
      `grimoire.db`.
- [x] Nothing is written until the wizard finishes, and the version stamp is
      written last.
- [x] The first reader becomes the current user and appears in the header
      avatar in their colour.
- [x] `bun run db:wipe` restores a genuine first-run state.
- [x] The wizard, the colour picker and the reader avatar each have Storybook
      stories.

## Open questions

- Readers can be added — here or in [Settings](settings.md) — but never renamed
  or removed, so a typo made during setup survives.
- Switching the current reader happens in [Settings](settings.md); the header
  avatar shows them but is not itself a picker.
- Colour uniqueness is not enforced; two readers may share a colour, and past 24
  readers they must.
- Nothing asks whether this instance is shared over a LAN, which is where
  [ADR 0008](../adrs/0008-multiple-users-without-authentication.md)'s "do not
  expose this to the internet" warning would be most useful.
