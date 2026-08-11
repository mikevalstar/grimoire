---
type: feature
title: Settings
description: One dialog behind the header's gear holding everything configurable after first run — the Calibre connection and the readers who share this library.
tags: [frontend, ui, configuration, users]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-11 }
---

# Settings

## Summary

The gear in the header opens one dialog with everything that can be changed
after setup: where the Calibre content server is, who reads here, and which of
those readers is using this device.

## Motivation

The [setup wizard](first-run-setup-wizard.md) asks its questions once and then
gets out of the way, which leaves no way to answer them differently later — a
content server that moved to another port, or a reader who joined the household
after setup. Settings is where those answers live for the rest of the app's
life.

There is little enough to configure that splitting it into a settings *page*
with sections and routes would be more navigation than content. One dialog, one
scroll, sections as headings. When it outgrows that, it becomes a route and this
doc gets superseded.

## Behavior

A regular dialog — Escape, the close button and clicking outside all dismiss it,
unlike the wizard's locked-down modal. Opened by the header gear, which was
inert until now.

### Library

The Calibre content server URL, with the same server-side **Test** probe the
wizard uses ([ADR 0005](../adrs/0005-calibre-content-server-as-the-data-source.md)),
reporting the book count on success. **Save** writes the URL to preferences and
closes; because the API resolves the proxy target per request, the new server is
live immediately with no restart. Saving also drops the cached book list, so the
library reloads from wherever it now points.

### Readers

Everyone in `grimoire.db` ([ADR 0008](../adrs/0008-multiple-users-without-authentication.md)),
as avatar chips. Two things happen here:

- **Who's using this device** — picking a reader marks them as current and the
  header avatar changes to them at once. Stored in `localStorage`, so it is a
  per-device convenience and not a credential; other devices are unaffected.
- **Add a reader** — the same name and 24-colour picker the wizard uses,
  writing immediately rather than on Save. A new reader is pre-assigned the
  first free colour, and duplicate names are refused by the API.

Renaming and removing readers are not here yet. Removal in particular needs an
answer for what happens to that reader's data, and inventing one before there
*is* per-reader data would be guessing.

### What saves when

Deliberately mixed, and worth stating: **Save** commits the content server URL
only. Choosing the current reader and adding a reader both apply the moment you
do them — there is nothing to review and no half-typed state to protect, and
making them wait behind Save would only invite closing the dialog and losing
them.

## Acceptance criteria

- [x] The header gear opens the dialog; Escape, the close button and an outside
      click all close it.
- [x] The Calibre URL can be tested and saved, and the library reloads against
      the new server without a restart.
- [x] Every reader is listed; picking one changes the header avatar immediately
      and survives a reload.
- [x] A reader can be added, with a colour, and appears in the list at once.
- [x] The dialog has a Storybook story.

## Open questions

- No rename or remove for readers, so a typo made during setup still survives.
- The theme toggle stays in the header rather than moving in here; if settings
  grows a general "appearance" section that decision should be revisited.
- Nothing here explains that the header avatar is not a login. The wording may
  need to work harder once a Grimoire instance is routinely shared over a LAN.
- Every setting is global except the current reader. The first genuinely
  per-reader preference will force a decision about how this dialog splits.
