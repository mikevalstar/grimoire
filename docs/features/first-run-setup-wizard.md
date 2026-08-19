---
type: feature
title: First-run setup wizard
description: The welcome flow shown the first time Grimoire opens. It introduces the app, connects the Calibre content server, adds the people who will read from this library, and optionally links each of them to their hardcover.app account.
tags: [frontend, ui, onboarding, users, configuration, hardcover]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-11 }
---

# First-run setup wizard

## Summary

The first time Grimoire opens it takes over the window with a short, stepped
wizard: a welcome, the Calibre content server connection, the readers who share
this library, and, optionally, each reader's own hardcover.app account. When it
finishes, preferences are saved, the readers exist in `grimoire.db`, any
Hardcover links are stored, and the first library sync is already running.

This is **not** the [settings dialog](settings.md). The wizard runs once, asks
only for what is needed to start, and is written to welcome someone who has just
installed the app. Settings is where the same values get changed later.

## Motivation

Grimoire cannot show anything until it knows where the Calibre content server is
([ADR 0005](../adrs/0005-calibre-content-server-as-the-data-source.md)), so
*some* gate has to exist before the library. Given that we have to interrupt the
user anyway, first run is also the only moment where asking "who reads here?" is
natural rather than a chore. Grimoire separates per-user data from day one
([ADR 0008](../adrs/0008-multiple-users-without-authentication.md)), so someone
has to answer that question before there is anything to attach to a person.

The first screen of a self-hosted app is usually a form. Grimoire's is a
welcome. It says what the app does and where its data comes from, and only then
asks for a URL.

## Behavior

Five steps in one non-dismissable modal, with a visible position indicator and a
**Back** that returns to any earlier step with the answers intact. There is no
Escape, no click-outside and no close button, because leaving mid-setup would
land on an app that cannot render. Copy stays short and plain throughout; this
is a setup screen, not a pitch.

**1. Welcome.** What Grimoire is, in a line and three points: where the data
comes from, multiple readers, desktop and browser.

**2. Connect to Calibre.** The content server URL and how to turn the server on
in Calibre. **Test** probes it server-side, so no CORS is involved, and reports
the book count. **Continue** tests an untested URL first. A successful probe
advances; a failed one shows the error and offers **Continue anyway**, so a user
whose server isn't running yet gets a warning but never gets trapped.

**3. Who's reading?** The step that gives the library its people. Each reader is
a name and a colour. The name is required, trimmed, length-capped and unique
case-insensitively. The colour comes from a fixed palette, pre-assigned to the
first one nobody has taken, so a household that presses Enter four times still
gets four distinguishable people. A first run cannot finish with no readers; a
re-run can, since last time's readers are already there.

The wizard holds readers as removable drafts and writes them when you leave the
step with **Continue**, because the next step needs them to exist. Anyone
already in the database is listed but locked, and a retry creates only the ones
still missing.

**Reader colours are their own plane.** The shell reserves indigo for what is
yours and amber for other readers' data
([application shell](application-shell.md)). That rule governs *library data*. A
reader colour identifies a *person* and only ever appears on their avatar or
chip; it never colours a rating, a progress bar or a selection.

**4. Link Hardcover.** Optional, and says so. One card per reader, the same card
[settings](settings.md) shows in its Hardcover section, because the token
belongs to a person, not to a setting
([ADR 0012](../adrs/0012-hardcover-as-a-second-source-with-per-reader-tokens.md),
[Hardcover connection](hardcover-connection.md)). A household pastes each
person's token against the right face, and a linked reader can pull their
shelves in before ever seeing the app. **Finish** works with none, some or all
readers linked; anyone skipped links later in settings.

**5. You're all set.** A confirmation rather than a form: the book count found,
the readers as chips, and **Open library**. The first reader becomes the current
user, a per-device convenience rather than a credential, so the header avatar
shows a real person immediately.

**Ordering.** The wizard writes in step order: readers when leaving their step,
Hardcover links as they are made, and the preferences on **Finish**. The
preferences are the content server URL and, last of all, the version stamp. Only
that final stamp marks setup complete, so a failure anywhere earlier brings the
wizard back on reload with everything already created shown as locked. Saving
the URL also starts the first library sync ([calibre-sync](calibre-sync.md)).
The server re-arms and syncs when the stored URL changes, so the shelf is
filling by the time the library opens.

### Re-running the wizard

The gate is `preferences.version` against `PREFERENCES_VERSION`: a fresh
database seeds below it and the wizard runs while the stored value is lower.
Bumping that constant sends existing installs back through, with saved answers
pre-filled and existing readers locked. Adding a step means bumping it in the
same commit. `bun run db:wipe` restores a genuine first run.

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

The stored `color` is a colour id, never a hex value, so the palette can be
restyled without a migration. `GET` and `POST /api/users` list and create; the
API refuses a duplicate name. Adding a reader later happens in
[settings](settings.md); renaming and deleting are not built anywhere yet.

## Acceptance criteria

- [x] The wizard gates the whole app until preferences are current, and cannot
      be dismissed.
- [x] Five steps: welcome, Calibre, readers, Hardcover, done, with a visible
      position indicator and working Back.
- [x] Continue tests an untested URL, and a failed probe warns without trapping
      the user.
- [x] A first run cannot leave the readers step with no readers; names are
      trimmed, length-capped and rejected as duplicates case-insensitively.
- [x] Colours come from the fixed palette, pre-assigned to the first free one,
      and are stored as ids.
- [x] Readers are created on leaving their step; the version stamp is written
      last, so an interrupted run resumes with created readers locked.
- [x] The Hardcover step shows the same per-reader card settings does, and
      Finish works with none, some or all readers linked.
- [x] The first reader becomes the current user and appears in the header avatar
      in their colour.
- [x] Finishing starts the first library sync when the content server URL was
      newly saved.
- [x] `bun run db:wipe` restores a genuine first-run state.
- [x] The wizard, the colour picker and the reader avatar each have Storybook
      stories, including one on the Hardcover step.

## Open questions

- You can add readers, here or in [settings](settings.md), but never rename or
  remove them, so a typo that survives the draft list survives forever.
- Switching the current reader happens from the header avatar menu
  ([application shell](application-shell.md)); the wizard only picks the
  starting one.
- Colour uniqueness is not enforced; past the size of the palette it cannot be.
- Nothing asks whether this instance is shared over a LAN, which is where
  [ADR 0008](../adrs/0008-multiple-users-without-authentication.md)'s "do not
  expose this to the internet" warning would be most useful.
