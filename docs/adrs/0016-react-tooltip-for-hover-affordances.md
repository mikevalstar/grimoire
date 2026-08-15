---
type: adr
title: react-tooltip for hover affordances
description: Replace native title attributes and per-target Radix tooltips with react-tooltip, driven by one shared instance mounted in the application shell.
tags: [frontend, ui, accessibility, performance]
status: stable
generated: { by: okq/0.8.0, at: 2026-08-15 }
---

# react-tooltip for hover affordances

## Status

Accepted. Narrows the tooltip part of
[ADR 0004](0004-frontend-stack-react-shadcn-ui-tanstack-router-and-query-storybook.md).

## Context

Grimoire had two unrelated ways of explaining a small control. Most of them —
source marks, the cover stack, the download chips, the clear-rating ×, the
quick filter's × — used the browser's `title` attribute: unstyled, ~1s late,
different on every platform, and invisible to touch. The header's
[sync indicator](../features/calibre-sync.md) instead used a Radix tooltip,
which looks right but mounts a `Root`/`Trigger`/`Content` triple per target and
needs a provider above it.

The controls that need explaining are almost all *inside* the
[book list](../features/book-list.md), which is now virtualized
([ADR 0015](0015-virtualize-library-views-with-tanstack-virtual.md)). Rows mount
and unmount as the shelf scrolls, so a per-target tooltip component means
mounting and tearing down a tooltip subtree — with its own listeners and
floating-element machinery — for every book that crosses the viewport. That is
exactly the cost virtualization was adopted to avoid.

## Decision

Use [react-tooltip](https://react-tooltip.com) with **one instance for the whole
app**, wrapped in `apps/web/src/components/ui/tooltip.tsx`.

- `<TooltipHost />` renders the single `<Tooltip>` from the
  [application shell](../features/application-shell.md), and Storybook mounts
  the same component from a global decorator.
- Targets opt in with data attributes rather than by wrapping themselves. Call
  sites never hand-write those attributes: `tooltipProps(text, place)` returns
  the typed prop object, and returns nothing when there is no text, so an
  absent tooltip is an absent attribute.
- The host disables react-tooltip's own visual styles and is dressed in the
  app's popover tokens, so it flips with the theme like every other floating
  surface. It portals to `document.body` and positions `fixed`, which puts it
  above the [details panel](../features/book-details-panel.md) sheet and clear
  of the shell's `overflow-hidden`.
- A tooltip is never the only way to read a control. Every target keeps its
  `aria-label` or its visually hidden name; the tooltip repeats or expands on
  it for sighted pointer users.

react-tooltip won because the single-instance, data-attribute model is its
native design rather than something built on top of it — one set of listeners,
one floating element, and a virtualized row that costs three static attributes.
Radix stays for the things it is better at: menus, dialogs and the sheet.

## Consequences

Scrolling a large shelf no longer mounts tooltip subtrees. Every hover
explanation in the app now looks the same, appears at the same speed, and
follows the theme.

The tradeoff is that tooltip content is a string carried in the DOM rather than
arbitrary JSX. That is enough for every current call site, and it keeps the
`data-tooltip-html` escape hatch — which would need sanitizing — unused. A
target must also be a real element that accepts data attributes, so a component
wanting a tooltip has to spread the props onto its own root.

Two tooltip systems no longer coexist; `title` remains only where the browser's
own affordance is genuinely wanted.
