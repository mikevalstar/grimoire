---
type: adr
title: Library view state lives in the URL
description: The filter query, sources, read status, sort and group all become search parameters, so any view of the library is a link.
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
  filter sat in plain `useState` in `book-library.tsx`, gone on reload;
- [sort, direction and group](../features/library-sort-and-group.md) came from
  a `localStorage` store read through `useSyncExternalStore`;
- the view mode used `localStorage`, same shape.

Two things forced the question. Filter terms (`author:…`, `series:…`) make a
filtered shelf worth returning to rather than a passing narrowing, and clicking
an author name on a card is a navigation that ought to leave a back button
behind it. Then there is "send me the link to your 2024 reading", the obvious
next ask, and no amount of `localStorage` answers it.

The app already routes with TanStack Router, which validates and types search
parameters the same way the API validates payloads with Zod
([ADR 0009](0009-zod-schemas-shared-between-api-and-client.md)).

## Decision

**The URL is the source of truth for how the library is narrowed and ordered.**
`/` takes typed search parameters: `q`, `sources`, `read`, `sort`, `dir`,
`group`. The route validates them, and the library screen reads them through
the router rather than out of component state.

Three rules keep it honest:

- **Defaults are absent.** The route drops any *filter* equal to its default,
  so a plain `/` is the plain shelf and a shared link carries only what
  somebody chose. The order triple is the exception. It gets written whole or
  not at all, because it defaults from `localStorage` rather than from a
  constant, and dropping `sort=title` would hand the next read back to a stored
  `sort=added`, the opposite of what the reader just asked for.
- **Filters replace, choices push.** Typing in the filter box replaces the
  current history entry, since otherwise every keystroke is a back step.
  Clicking an author, a series, or a sort/group option pushes one, because
  those are navigations a reader will want to undo.
- **Order still sticks per device.** Sort, direction and group keep their
  `localStorage` mirror, but only as the *default* for a URL that doesn't
  name them. An explicit parameter always wins, so the recipient's stored
  preference never quietly reinterprets a link.

The view mode, covers or list, stays out of the URL and stays in
`localStorage`. It is not a view *of the library*, it is how this device draws
whatever it is given; a phone opening a link from a desktop wants its own
answer.

## Consequences

Every filtered, sorted, grouped shelf is a link, and the browser's back button
works through filtering for the first time. Reload no longer discards a filter.
Component state in `book-library.tsx` collapses into one typed object, and
future filters are one field on a schema rather than another `useState`.

The desktop build routes in the hash ([router.tsx](../../apps/web/src/router.tsx)),
so its links are `views://…#/?q=…`. They work inside the app and nowhere else.
That is the hash history's cost, already paid.

Parameters are a public interface now. Renaming `q` breaks somebody's bookmark.
They stay short and few for that reason, and the route drops unknown ones
rather than preserving them.

A URL can describe a shelf that no longer exists: a source that left the
library, a reader whose marks are gone. Each control already falls back to
"everything" rather than to an empty shelf, and the app now depends on that.
