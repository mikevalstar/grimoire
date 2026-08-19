---
type: feature
title: Library quick filter
description: A clearable, typo-tolerant text filter that ranks books by matches across their core metadata, and takes field terms like author: and series: separated by semicolons.
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

It also accepts field terms separated by semicolons, such as
`author:Ursula Le Guin` or `series:Earthsea`. A term narrows to one field
instead of ranking across all of them. The whole query lives in the URL
([ADR 0020](../adrs/0020-library-view-state-lives-in-the-url.md)), so a filtered
shelf is a link.

## Motivation

A large shelf is slow to browse when somebody remembers only fragments such as
an author's first name and one word of a title. The library is already held in
the browser, so this common lookup should answer immediately without a server
round trip or the extra ceremony of the [command palette](command-palette.md).

Ranked free text answers "find me this book". It answers "show me everything by
this author" badly: a common surname pulls in titles, and there is no way to say
*which* field the words belong to. Field terms are that missing half. They also
give the app one place to send a click on an author or a series name, rather
than inventing a second filtering mechanism for pills.

Semicolons rather than spaces separate the terms because the values are names,
and names have spaces in them. Quoting would be the alternative, and it is
worse to type.

## Behavior

**Free text.** The query is folded for case, accents, and punctuation, then
split into words. Every query word must match somewhere on the same book, but
the words can land in different fields and in any order: `alastair revelation`
can match Alastair Reynolds's *Revelation Space*. Title matches rank ahead of
author, series, and identifier matches; exact words and prefixes rank ahead of
substrings.

For words of at least four characters, a small edit-distance allowance accepts
one typo (two for longer words). This is deliberately word-local rather than a
fuzzy match against the whole metadata string, keeping short and numeric
queries predictable.

**Field terms.** A segment of the form `field:value` narrows to that field.
The recognised fields are `author` and `series`; anything else is not a term at
all and stays free text, so a query like `note: to self` filters on the literal
words rather than silently matching nothing. Field names are matched
case-insensitively.

A term matches when the folded value appears anywhere in the folded field, so
`author:le guin` finds "Ursula K. Le Guin". That is what makes both a typed
fragment and a whole name pasted in by a click work. Authors are matched one at
a time, so a term matches a book credited to that person among others. Series
are matched against every series a book belongs to
([ADR 0019](../adrs/0019-series-as-records-with-a-primary-per-work.md)), not
only the primary one. Unlike free text, terms are exact-substring with no typo
allowance, because a term is usually a click rather than a guess.

**Combining.** Semicolons split the query into segments; leading and trailing
whitespace on each is ignored, and empty ones are dropped. Then:

- terms on the same field OR: `author:Sanderson; author:Gaiman` is everything
  by either;
- different fields AND: `author:Sanderson; series:Mistborn` is the
  intersection;
- any segments that are not terms rejoin with spaces into one free-text query,
  ANDed with the rest and still supplying the relevance ranking.

**Ordering.** Relevance is the primary ordering while a free-text query is
active. The chosen library sort breaks ties, and it sets the order outright
when there is no free text, so a query of nothing but field terms is ordered
entirely by the library's own sort. Grouping continues to split matching
results into the selected sections.

**Filling it.** Author names and series names are clickable wherever the app
shows them as an identity rather than as prose: on a cover card and in the
[details panel](book-details-panel.md) header. Clicking one replaces the whole
query with the corresponding term; the details panel closes behind it, since
the click was a request to look at the shelf. See [book list](book-list.md).

**Clearing.** The toolbar count is the number of matches. Clearing the box,
either with its visible clear button or by deleting the text, restores the
complete shelf and its normal order. A non-empty query with no matches gets a
dedicated empty state, not the library-is-empty message, and it names the terms
that failed rather than quoting the raw query at the reader.

## Acceptance criteria

- [x] A labelled text field appears at the left of the filter bar and filters
      both cover and table views immediately without refetching.
- [x] Every free-text token matches across title, author, series, or Amazon/
      ISBN/Google identifier values; tokens may match different fields.
- [x] Results are ranked by relevance, with exact and title matches preferred,
      and minor misspellings of words at least four characters tolerated.
- [x] `author:` and `series:` terms narrow to that field by folded substring,
      across every author and every series a book has.
- [x] Semicolons separate terms; repeated fields OR, distinct fields AND, and
      leftover segments become one free-text query ANDed with them.
- [x] An unrecognised `word:` prefix is treated as free text, not as an empty
      filter.
- [x] The query round-trips through the URL, so a filtered shelf can be
      bookmarked and shared ([ADR 0020](../adrs/0020-library-view-state-lives-in-the-url.md)).
- [x] The result count, grouped sections, and no-results state reflect the
      filtered shelf.
- [x] The clear button empties the query and returns keyboard focus to the box.
- [x] The quick-filter control has a Storybook story in both themes.

## Open questions

- **More fields.** `tag:`, `format:`, `publisher:`, `language:` and a
  `rating:>=4` style comparison are all the same shape and unbuilt. Negation
  (`-author:…`) likewise.
- **Discoverability.** Today the only way to learn the syntax is to click an
  author name and read what appears in the box. A hint in the placeholder, or
  completion of field names as you type, would help.
- **Chips.** The box shows a term as raw text. Rendering each as a removable
  pill is the natural next step, and the parse already produces the right
  structure for it.
- Whether the command palette should hand an unmatched query into this filter.
- Whether a future server-paged library needs the same ranking implemented in
  SQL rather than in the browser.
