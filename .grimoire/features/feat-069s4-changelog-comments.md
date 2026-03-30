---
id: "feat-069s4-changelog-comments"
uid: "069s4"
title: "Changelog & Comments"
type: "feature"
status: "complete"
priority: "medium"
created: "2026-03-29"
updated: "2026-03-30"
tags:
  - core
  - cli
requirements: []
decisions: []
---

# Changelog & Comments

**Why:** AI agents and humans need a shared, auditable trail of progress and discussion on any document. Without this, context is lost between sessions and contributors.

## Scope

- `grimoire log <id> <message>` — append a changelog entry with optional `--author`
- `grimoire comment <id> <message>` — append a blockquoted comment (shorthand for `log --comment`)
- Entries follow the format: `### YYYY-MM-DD HH:mm | author`
- Comments are blockquoted (`>`), changelog entries are plain text
- Both sections are included in embedded content for semantic search

## Acceptance criteria

- Log and comment commands append entries to the correct document section
- Entries include timestamp and author
- `--author` flag defaults to a sensible value when omitted
- Existing document content is preserved when appending

## Non-goals

- No threaded replies or nested comments
- No notifications or subscriptions
