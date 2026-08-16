---
type: adr
title: Library view state lives in the URL
description: Everything that narrows or orders the shelf — the filter query, sources, read status, sort and group — becomes a search parameter, so any view of the library is a link.
tags: [frontend, library, routing, url, sharing]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-16 }
---

# Library view state lives in the URL

## Status

Proposed.

## Context

The [book list](../features/book-list.md) had accumulated six independent
pieces of view state, each stored differently and none of them addressable:

- the [quick filter](../features/library-quick-filter.md) query, the
  [source filter](../features/library-source-filter.md), and the read-status
  filter — plain `useState` in `book-library.tsx`, gone on reload;
- [sort, direction and group](../features/library-sort-and-group.md) — a
  `localStorage` store read through `useSyncExternalStore`;
- the view mode — `localStorage`, same shape.

Two things forced the question. Filter terms
(`author:…`, `series:…`) make a filtered shelf worth returning to rather than a
transient narrowing, and clicking an author name on a card is a navigation
gesture that ought to leave a back button behind it. And "send me the link to
your 2024 reading" is the obvious next ask, which no amount of `localStorage`
can answer.

The app already routes with TanStack Router, which validates and types search
parameters the same way the API validates payloads with Zod
([ADR 0009](0009-zod-schemas-shared-between-api-and-client.md)).

## Decision

**The URL is the source of truth for how the library is narrowed and ordered.**
`/` takes typed search parameters — `q`, `sources`, `read`, `sort`, `dir`,
`group` — validated on the route and read by the library screen through the
router rather than through component state.

Three rules keep it honest:

- **Defaults are absent.** A *filter* equal to its default is stripped from the
  URL, so a plain `/` is the plain shelf and a shared link carries only what
  somebody actually chose. The order triple is the exception: it is written
  whole or not at all, because it defaults from `localStorage` rather than from
  a constant, and dropping `sort=title` would hand the next read back to a
  stored `sort=added` — the opposite of what the reader just asked for.
- **Filters replace, choices push.** Typing in the filter box replaces the
  current history entry — otherwise every keystroke is a back step — while
  clicking an author, a series, or a sort/group option pushes one, because
  those are navigations a reader will want to undo.
- **Order still sticks per device.** Sort, direction and group keep their
  `localStorage` mirror, but only as the *default* for a URL that doesn't
  name them. An explicit parameter always wins, so a link is never quietly
  reinterpreted by the recipient's stored preference.

The view mode — covers or list — stays out of the URL and stays in
`localStorage`. It is not a view *of the library*, it is how this device draws
whatever it is given; a phone opening a link from a desktop wants its own
answer.

## Consequences

Every filtered, sorted, grouped shelf is a link, and the browser's back button
works through filtering for the first time. Reload no longer discards a filter.
Component state in `book-library.tsx` collapses into one typed object, and
future filters are one field on a schema rather than another `useState`.

The desktop build routes in the hash ([router.tsx](../../apps/web/src/router.tsx)),
so its links are `views://…#/?q=…` — internally consistent, but not shareable
outside the app. That is the hash history's cost, already paid.

Parameters are a public interface now: renaming `q` breaks somebody's bookmark.
They are deliberately short and few for that reason, and unknown ones are
dropped rather than preserved.

A URL can describe a shelf that no longer exists — a source that left the
library, a reader whose marks are gone. Each control already degrades to
"everything" rather than to an empty shelf, and that behaviour is now load-
bearing.
