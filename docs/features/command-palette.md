---
type: feature
title: Command palette
description: A Cmd+K menu that drops down from the header search trigger. Find and open a book, or run any global action, without leaving the keyboard.
tags: [frontend, ui, library, navigation]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-15 }
---

# Command palette

## Summary

Pressing Cmd+K (or clicking the header's search trigger) opens a panel that
drops down beneath the trigger. Typing searches the library and the app's
commands at once. Pick a book to open its
[details panel](book-details-panel.md), or run an action: switch view, sort,
group, change reader, sync, open a settings section, flip the theme. Either
way the panel closes.

## Motivation

The [application shell](application-shell.md) has carried an inert search
trigger since it landed. This makes it real. Everything the palette does is
already reachable through toolbar menus and header buttons, so the palette's
job is speed. One keystroke, a few characters, Enter. It is also a
keyboard-first way into the same search the
[library quick filter](library-quick-filter.md) uses.

## Behavior

**A dropdown, not a takeover.** The panel hangs under the header search
trigger rather than floating over a dimmed screen, so the library stays
visible behind it. Structurally it is still a dialog: focus moves into it, and
Esc or a click elsewhere dismisses it. But the overlay is transparent, so it
reads as the trigger expanding rather than a mode switch.

**Opening.** Cmd+K or Ctrl+K opens it from anywhere, and pressing it again
closes it. Both header triggers (the wide bar and the narrow-screen icon) open
it. Focus lands in the input; the query resets on close.

**Empty query.** The full command list, grouped: view (covers/list), sort
(one entry per [sort key](library-sort-and-group.md), re-running the active
one flips direction, same as the toolbar menu), group, readers (switch to each
other reader, add one), library
([add a book from Hardcover](adding-a-book-from-hardcover.md), for a linked
reader), sync now, settings by section, theme. Dynamic commands
name their target ("Switch to list view"), not their category.

**The commands move the same state the toolbar does.** Sort and group live in
the URL ([ADR 0020](../adrs/0020-library-view-state-lives-in-the-url.md)). The
palette reads its markers, the active key's direction arrow and the active
grouping's check, from the shelf the URL describes. It writes back there too,
pushing a history entry the way clicking the toolbar menu does. The
`localStorage` mirror is only the fallback on a screen with no library behind
it, such as a Storybook story.

**Typing.** Book matches come first. The palette and the
[library quick filter](library-quick-filter.md) call the same ranked matcher,
so title, author, series, Amazon, ISBN, Google, multi-token, accent, and typo
behavior cannot drift between the two. The palette's only change is capping
that shared ranked result at six. Commands whose label or keywords match
follow. Enter runs the highlighted row, arrow keys move the highlight, and a
footer strip shows the key hints. No matches shows a plain empty state.

**Out of scope for now.** A "filter the library for this text" row that hands
the palette query into the toolbar filter. Per-command shortcut keys and
recently-opened books are also deferred until wanted.

## Acceptance criteria

- [ ] Cmd+K / Ctrl+K toggles the palette from anywhere in the app; the header
      search trigger (both widths) opens it.
- [ ] The panel drops down under the trigger with no dimmed backdrop; the
      library remains visible behind it.
- [x] Book search uses the same ranked matcher as the library quick filter;
      typing a title, author, series, or identifier surfaces the book and Enter
      opens its details panel.
- [ ] Every command visible in the empty state does what its toolbar/header
      equivalent does, including the flip-direction re-sort behaviour.
- [ ] Esc and clicking outside dismiss it; reopening starts with a clean query.
- [ ] The palette has a Storybook story covering both themes and a populated
      query.

## Open questions

- Whether the palette should also search authors/series as first-class rows
  (jumping to a filtered view) once the filter bar exists.
