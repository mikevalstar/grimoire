---
type: adr
title: Virtualize library views with TanStack Virtual
description: Keep the whole library client-side while mounting only the visible table and cover-grid rows with TanStack Virtual.
tags: [frontend, ui, performance, library]
status: stable
generated: { by: okq/0.8.0, at: 2026-08-15 }
---

# Virtualize library views with TanStack Virtual

## Status

Accepted.

## Context

The [book list](../features/book-list.md) receives the whole library because its
quick search, sort and grouping run client-side. Both views also mounted one
React subtree per book. A large shelf therefore paid the DOM, component and
image setup cost for every book, including the ones far outside the scrollport.

Paging the API would mean moving search, sort, grouping and per-reader state
ordering to the server. That is a wider product and API decision than cutting
the current rendering cost.

## Decision

Use `@tanstack/react-virtual` in both library views while keeping the whole
book array and the existing client-side ordering.

- The dense table virtualizes a flat sequence of section headings and book
  rows inside the library's existing scroll element.
- The cover shelf computes its responsive column count, chunks each section
  into visual rows, and virtualizes those rows. Section headings remain their
  own full-width rows.
- Both views measure rows as they render and keep a small overscan above and
  below the viewport. The virtualizer owns vertical size and position, nothing
  else. Grimoire still owns markup, styling and interaction.

TanStack Virtual is headless and fits the React and TanStack choices in
[ADR 0004](0004-frontend-stack-react-shadcn-ui-tanstack-router-and-query-storybook.md).
Virtualizing visual rows rather than individual cover cards also makes a
responsive grid and its grouped headings behave predictably.

## Consequences

Large libraries now mount work proportional to the viewport, not to the number
of books. Search, sorting, grouping, ratings and the details panel behave as
before. The browser keeps one continuous scrollbar and cover rows still reflow
with the window.

The views now depend on their owning scroll element and on measured layout.
Responsive grid rows need an explicit column-count calculation, and it has to
track the design's minimum card widths. Storybook stories without a bounded
scroll element may fall back to rendering the whole small sample. None of this
fixes the memory and CPU cost of fetching, searching and sorting a truly huge
library. Server-side querying is a later decision if those costs start to
hurt.
