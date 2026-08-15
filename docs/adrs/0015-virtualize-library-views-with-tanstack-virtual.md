---
type: adr
title: Virtualize library views with TanStack Virtual
description: Keep the complete client-side library model while mounting only the visible table and cover-grid rows with TanStack Virtual.
tags: [frontend, ui, performance, library]
status: stable
generated: { by: okq/0.8.0, at: 2026-08-15 }
---

# Virtualize library views with TanStack Virtual

## Status

Accepted.

## Context

The [book list](../features/book-list.md) receives the whole library because its
quick search, sort and grouping are client-side. Both views also mounted one
React subtree per book. A large shelf therefore paid the DOM, component and
image setup cost for books far outside the scrollport, even though only a few
rows were visible.

Paging the API would also require moving search, sort, grouping and per-reader
state ordering to the server. That is a wider product and API decision than
reducing the current rendering cost.

## Decision

Use `@tanstack/react-virtual` in both library views while keeping the complete
book array and the existing client-side ordering.

- The dense table virtualizes a flat sequence of section headings and book
  rows inside the library's existing scroll element.
- The cover shelf computes its responsive column count, chunks each section
  into visual rows, and virtualizes those rows. Section headings remain their
  own full-width rows.
- Both views dynamically measure rendered rows and keep a small overscan above
  and below the viewport. The virtualizer owns only vertical size and position;
  Grimoire continues to own markup, styling and interaction.

TanStack Virtual is headless and fits the React and TanStack choices in
[ADR 0004](0004-frontend-stack-react-shadcn-ui-tanstack-router-and-query-storybook.md).
Virtualizing visual rows rather than individual cover cards also makes a
responsive grid and its grouped headings deterministic.

## Consequences

Large libraries mount work proportional to the viewport rather than the number
of books, without changing search, sorting, grouping, ratings or details-panel
behavior. The browser retains one continuous scrollbar and cover rows still
reflow with the window.

The views now depend on their owning scroll element and on measured layout.
Responsive grid rows need an explicit column-count calculation kept in step
with the design's minimum card widths. Storybook stories without a bounded
scroll element may fall back to rendering the whole small sample. This does not
solve the memory and CPU cost of fetching, searching and sorting a truly huge
library; server-side querying remains a later decision if those costs become
material.
