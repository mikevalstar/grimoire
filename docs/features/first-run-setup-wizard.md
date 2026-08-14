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
in `grimoire.db`, and the app is usable.

This is **not** the [settings dialog](settings.md). The wizard runs once, asks
only for what is needed to start, and is written to welcome someone who has just
installed the app. Settings is where the same values get changed later.

## Motivation

Grimoire cannot show anything until it knows where the Calibre content server is
([ADR 0005](../adrs/0005-calibre-content-server-as-the-data-source.md)), so
*some* gate has to exist before the library. Given that we have to interrupt the
user anyway, first run is also the only moment where asking "who reads here?" is
natural rather than a chore — and per-user data is separated from day one
([ADR 0008](../adrs/0008-multiple-users-without-authentication.md)), so the
question has to be answered before there is anything to attach to a person.

The first screen of a self-hosted app is usually a form. Grimoire's is a
welcome: it says what the app does and where its data comes from, and only then
asks for a URL.

## Behavior

Four steps in one non-dismissable modal, with a visible position indicator and a
**Back** that returns to any earlier step with the answers intact. There is no
Escape, no click-outside and no close button — leaving mid-setup would land on
an app that cannot render. Copy stays short and plain throughout; this is a
setup screen, not a pitch.

**1 — Welcome.** What Grimoire is, in a line and three points: where the data
comes from, multiple readers, desktop and browser.

**2 — Connect to Calibre.** The content server URL and how to turn the server on
in Calibre. **Test** probes it server-side, so no CORS is involved, and reports
the book count. **Continue** tests an untested URL first: a successful probe
advances, a failed one shows the error and offers **Continue anyway**, so a user
whose server merely isn't running yet is warned but never trapped.

**3 — Who's reading?** The step that makes the library feel like it belongs to
someone. Each reader is a name — required, trimmed, length-capped, unique
case-insensitively — and a colour from a fixed palette, pre-assigned to the
first one nobody has taken, so a household that just presses Enter four times
still gets four distinguishable people. A first run cannot finish with no
readers; a re-run can, since last time's readers are already there.

Readers are held in local state and written only when the wizard finishes, so
backing out leaves no half-made people. Anyone already in the database is listed
but locked, and a retry creates only the ones still missing.

**Reader colours are their own plane.** The shell's rule — indigo marks what is
yours, amber is reserved for other readers' data
([application shell](application-shell.md)) — governs *library data*. A reader
colour identifies a *person* and only ever appears on their avatar or chip; it
never colours a rating, a progress bar or a selection.

**4 — You're all set.** A confirmation rather than a form: the book count found,
the readers as chips, and **Open library**. The first reader created becomes the
current user — a per-device convenience, not a credential — so the header avatar
shows a real person immediately.

**Ordering.** Finishing creates the readers first and stamps the preferences
version last. If reader creation fails, setup has not been marked complete, so
the wizard is still there on reload with the error shown against the reader that
failed.

### Re-running the wizard

The gate is `preferences.version` against `PREFERENCES_VERSION`: a fresh
database seeds below it and the wizard runs while the stored value is lower.
Bumping that constant sends existing installs back through, with saved answers
pre-filled and existing readers locked — so adding a step means bumping it in
the same commit. `bun run db:wipe` restores a genuine first run.

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

The stored `color` is a colour **id**, never a hex value, so the palette can be
restyled without a migration. `GET` and `POST /api/users` list and create;
a duplicate name is refused. Adding a reader later happens in
[settings](settings.md); renaming and deleting are not built anywhere yet.

## Acceptance criteria

- [x] The wizard gates the whole app until preferences are current, and cannot
      be dismissed.
- [x] Four steps — welcome, Calibre, readers, done — with a visible position
      indicator and working Back.
- [x] Continue tests an untested URL, and a failed probe warns without trapping
      the user.
- [x] A first run cannot finish with no readers; names are trimmed,
      length-capped and rejected as duplicates case-insensitively.
- [x] Colours come from the fixed palette, pre-assigned to the first free one,
      and are stored as ids.
- [x] Nothing is written until the wizard finishes, and the version stamp is
      written last.
- [x] The first reader becomes the current user and appears in the header avatar
      in their colour.
- [x] `bun run db:wipe` restores a genuine first-run state.
- [x] The wizard, the colour picker and the reader avatar each have Storybook
      stories.

## Open questions

- Readers can be added — here or in [settings](settings.md) — but never renamed
  or removed, so a typo made during setup survives.
- Switching the current reader happens in [settings](settings.md); the header
  avatar shows them but is not itself a picker.
- Colour uniqueness is not enforced; past the size of the palette it cannot be.
- Nothing asks whether this instance is shared over a LAN, which is where
  [ADR 0008](../adrs/0008-multiple-users-without-authentication.md)'s "do not
  expose this to the internet" warning would be most useful.
