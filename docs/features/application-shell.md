---
type: feature
title: Application shell
description: The persistent frame every screen renders inside — an ambient backdrop, a top header carrying the wordmark, search, sync, settings and the current reader, and a full-width content region.
tags: [frontend, ui, navigation]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-10 }
---

# Application shell

## Summary

Every screen in Grimoire renders inside one persistent frame: a sticky header
across the top and a scrolling content region beneath it that owns the full
width of the window.

## Motivation

Before any library feature exists there needs to be somewhere to put it. The
shell fixes the things that should not be re-decided per screen — where the app
identity sits, where global actions live, how wide content may run — so feature
work is about the feature.

It is also where the visual language is established, so new components land
close to the design instead of needing a rewrite.

## Behavior

**The palette.** Two accents are used strictly: an indigo `--you-*` marks
anything that is the reader's *own* — rating, progress, selection, focus — and
an amber `--hc-*` is reserved for data that comes from other readers. The
shadcn tokens are defined against these. Reader colours are a separate plane
and identify a *person*, never library data
([setup wizard](first-run-setup-wizard.md)).

**Two themes.** Dark is the design's home and the default; light is the same
structure inverted. Components draw their chrome from a small set of layer
tokens rather than naming colours, so the two themes flip with no per-component
branching. The choice is per-device, kept in `localStorage` rather than in
preferences — a phone browsing the same self-hosted library should not have to
match the desktop — and applies before first paint so there is no flash of the
wrong canvas.

**Header.** Sticky, translucent over scrolled content, holding left to right:
the wordmark linking to the library root; a search trigger, which opens the
[command palette](command-palette.md); a theme toggle; the
[sync indicator](calibre-sync.md); [settings](settings.md); and the current
reader as an avatar chip. It sheds the least essential of those on narrow
screens — the sync indicator stays, because it is also the error surface.

**Avatar menu.** The avatar chip is a menu: every reader, with the current one
marked — picking switches this device's reader instantly (a per-device
convenience, not a credential —
[ADR 0008](../adrs/0008-multiple-users-without-authentication.md)) — plus **Add
reader**, which opens [settings](settings.md) on its Readers section, and
**Settings** itself, which is also how narrow screens reach settings once the
gear is shed.

**Content region.** Everything else. It scrolls independently of the header and
runs full width with no max-width clamp, so screens render their own content
without re-establishing a layout. The [book list](book-list.md) is the first
screen to fill it.

**Tooltips.** The shell mounts the app's one and only tooltip
([ADR 0016](../adrs/0016-react-tooltip-for-hover-affordances.md)). Anything that
wants a hover explanation — a source mark in the
[book list](book-list.md), a control in the
[details panel](book-details-panel.md), the sync indicator — opts in with data
attributes rather than wrapping itself in a tooltip component. It portals to the
body and sits above the sheet, so a tooltip inside the details panel is neither
clipped nor underneath it.

**Setup gate.** The [first-run setup wizard](first-run-setup-wizard.md) renders
*above* the shell, not inside it: until preferences are configured there is no
library to frame.

## Acceptance criteria

- [x] A single shell wraps the router outlet, so every route gets the same frame
      without opting in.
- [x] Palette, radii and motion come from CSS custom properties, not from
      per-component literals, and no shell component hard-codes a theme colour.
- [x] The content region is full-width with no max-width clamp.
- [x] Both themes are switchable from the header, survive a reload, are
      per-device, and apply without a flash of the wrong canvas.
- [x] The header and shell each have a Storybook story, and Storybook has a
      theme toolbar so components are reviewable in both.
- [x] Settings and sync are reachable from every screen.
- [x] The avatar reflects a real current reader.
- [ ] The avatar opens a menu that switches reader, adds one, and opens
      settings.
- [x] The search trigger opens the [command palette](command-palette.md).
- [x] One tooltip instance serves every screen, follows the theme, and renders
      above the details panel's sheet without being clipped.

## Open questions

- There is no wordmark. The header is plain type until one is designed.
- The theme toggle is a two-way flip with no "follow the system" state.
- Latitude puts a third region — the Pulse rail — beside the library. Out of
  scope unless the hardcover.app integration lands.
