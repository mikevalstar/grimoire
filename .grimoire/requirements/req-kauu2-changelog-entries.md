---
id: "req-kauu2-changelog-entries"
uid: "kauu2"
title: "Changelog Entries"
type: "requirement"
status: "done"
priority: "medium"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - changelog
feature: "feat-069s4-changelog-comments"
tasks: []
depends_on: []
---

# Changelog Entries

**Parent Feature:** feat-069s4 — Changelog & Comments

## Description

`grimoire log <id> <message>` appends a timestamped changelog entry to a document's `## Changelog` section.

## Acceptance Criteria

- Appends entry in format `### YYYY-MM-DD HH:mm | author` followed by the message
- `--author` flag sets the author (defaults to git user or "agent")
- Entry is appended at the top of the Changelog section (newest first)
- Does not modify frontmatter or body content
- Returns success confirmation as JSON

---

## Comments

---

## Changelog

### 2026-03-30 20:07 | grimoire

Document created.
