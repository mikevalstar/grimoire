---
type: feature
title: Library quick filter
description: A clearable, typo-tolerant text filter that ranks books by matches across their core metadata.
tags: [frontend, ui, library, search]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-15 }
---

# Library quick filter

## Summary

A text box at the left of the [library sort and group](library-sort-and-group.md)
controls narrows the shelf as somebody types. It searches the title, authors,
series, and the Amazon, ISBN, and Google identifier values already held on each
book, then presents the strongest matches first.

## Motivation

A large shelf is slow to browse when somebody remembers only fragments such as
an author's first name and one word of a title. The library is already held in
the browser, so this common lookup should answer immediately without a server
round trip or the extra ceremony of the [command palette](command-palette.md).

## Behavior

The query is folded for case, accents, and punctuation, then split into words.
Every query word must match somewhere on the same book, but the words can land
in different fields and in any order: `alastair revelation` can match Alastair
Reynolds's *Revelation Space*. Title matches rank ahead of author, series, and
identifier matches; exact words and prefixes rank ahead of substrings.

For words of at least four characters, a small edit-distance allowance accepts
one typo (two for longer words). This is deliberately word-local rather than a
fuzzy match against the whole metadata string, keeping short and numeric
queries predictable. Relevance is the primary ordering while the filter is
active; the chosen library sort breaks ties and still determines order when the
box is empty. Grouping continues to split matching results into the selected
sections.

The toolbar count is the number of matches. Clearing the box — with its visible
clear button or by deleting the text — restores the complete shelf and its
normal order. A non-empty query with no matches gets a dedicated empty state,
not the library-is-empty message.

## Acceptance criteria

- [x] A labelled text field appears at the left of the filter bar and filters
      both cover and table views immediately without refetching.
- [x] Every query token matches across title, author, series, or Amazon/ISBN/
      Google identifier values; tokens may match different fields.
- [x] Results are ranked by relevance, with exact and title matches preferred,
      and minor misspellings of words at least four characters tolerated.
- [x] The result count, grouped sections, and no-results state reflect the
      filtered shelf.
- [x] The clear button empties the query and returns keyboard focus to the box.
- [x] The quick-filter control has a Storybook story in both themes.

## Open questions

- Whether the command palette should hand an unmatched query into this filter.
- Whether a future server-paged library needs the same ranking implemented in
  SQL rather than in the browser.
