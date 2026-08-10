---
type: feature
title: Application shell
description: The persistent frame every screen renders inside — ambient backdrop, a top header carrying the wordmark, search trigger, settings and user, and a full-width content region.
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
identity sits, where global actions live, how wide content may run, what the
page is made of visually — so feature work is about the feature.

It is also the first place the visual language is applied end to end, which is
how we find out whether the palette holds up before there is much to repaint.

**The palette.** System sans at 13px body / 11px meta, tabular numerals for
counts, and the spring curve `cubic-bezier(0.16, 1, 0.3, 1)` for entrances.
Two accents are fixed as CSS variables and used strictly: `--you-*` (indigo
`#6366f1`) marks anything that is the user's own — rating, progress, selection,
focus ring — and `--hc-*` (amber `#f59e0b`) is reserved for data that comes from
other readers, unused until such a source exists. The shadcn tokens installed by
[ADR 0004](../adrs/0004-frontend-stack-react-shadcn-ui-tanstack-router-and-query-storybook.md)
are defined against these, so new components land close to the design instead of
needing a rewrite.

**Two themes.** Dark is the design's home and the default: a blue-black
`#0a0c12` canvas, slate text ramp, hairline `white/8%` borders. Light is the
same structure inverted onto a `#f7f8fa` paper canvas. Rather than restate every
colour twice, the shell draws its own chrome from a small `--layer-*` set — a
hairline, a strong hairline, a raised fill, a strong fill — which is white-on-
dark and slate-on-light. Components use `border-line` / `bg-fill` and flip for
free. The two accents keep their hue across themes; only their readable-on-
canvas `soft` variant changes.

## Behavior

**Backdrop.** The canvas, lit by two very faint radial glows: indigo from the
top-left, amber from the bottom-right — the user and the crowd lighting the room
from opposite corners. The backdrop is fixed and never intercepts pointer
events.

**Header.** Sticky to the top, 56px tall, hairline bottom border, translucent
with a backdrop blur so content scrolling under it stays faintly visible. Left
to right:

- the wordmark — "Grimoire" as plain type, linking to the library root. There
  is no mark yet; one gets designed rather than borrowed;
- a search trigger, centred and capped in width: a button showing a
  placeholder and a `⌘K` keycap. It is the visual anchor for the command
  palette; until that exists the button is inert;
- a theme toggle — sun in dark mode, moon in light — flipping the two themes
  above;
- settings, as an icon button;
- the current user, as an avatar chip.

Below `sm` the wide search trigger collapses to a single search icon and
settings drops out; the header keeps the wordmark, search, theme and avatar.

**Theme persistence.** The choice is per-device, kept in `localStorage` under
`grimoire.theme` rather than in the preferences store — a phone browsing the
same self-hosted library should not have to match the desktop. A tiny inline
script in `index.html` applies the class before first paint so there is no flash
of the wrong canvas.

**Content region.** Everything else. It scrolls independently of the header,
runs full width with no max-width clamp, and applies its own padding — screens
render their own content into it without re-establishing a layout.

**Setup gate.** First-run setup still renders above the shell, not inside it:
until preferences are configured there is no library to frame.

## Acceptance criteria

- [x] A single `AppShell` wraps the router outlet, so every route gets the same
      frame without opting in.
- [x] The header is sticky and stays legible over scrolled content.
- [x] Palette, radii and motion come from CSS custom properties defined in
      `apps/web/src/index.css`, not from per-component literals.
- [x] The content region is full-width with no max-width clamp
      (Latitude requirement 21).
- [x] Both themes are switchable from the header, survive a reload, and apply
      without a flash of the wrong canvas.
- [x] No shell component hard-codes a `white/…` or `slate-…` colour; the two
      themes flip with no per-component branching.
- [x] The header and shell each have a Storybook story, and Storybook has a
      theme toolbar so components are reviewable in both.
- [ ] The search trigger opens a command palette.
- [ ] Settings opens a settings surface.
- [ ] The avatar reflects a real current user.

## Open questions

- The header currently shows a placeholder user; multiple users without
  authentication is settled in
  [ADR 0008](../adrs/0008-multiple-users-without-authentication.md), but how the
  shell picks and displays one is not.
- There is no wordmark. The header is plain type until one exists.
- The theme toggle is a straight two-way flip with dark as the default; there is
  no "follow the system" third state, and no decision yet on whether there
  should be.
- Latitude puts a third region — the Pulse rail — beside the library. It is out
  of scope here and only lands if the hardcover.app integration does.
