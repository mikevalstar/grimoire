---
id: "req-xcyho-comment-entries"
uid: "xcyho"
title: "Comment Entries"
type: "requirement"
status: "done"
priority: "medium"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - comments
feature: "feat-069s4-changelog-comments"
tasks: []
depends_on: []
---

# Comment Entries

**Parent Feature:** feat-069s4 — Changelog & Comments

## Description

`grimoire comment <id> <message>` appends a blockquoted comment entry to a document's `## Comments` section. This is shorthand for `grimoire log --comment`.

## Acceptance Criteria

- Appends entry in format `### YYYY-MM-DD HH:mm | author` followed by blockquoted message (`> ...`)
- `--author` flag sets the author
- Entry is appended at the top of the Comments section (newest first)
- Does not modify frontmatter or body content
- Returns success confirmation as JSON

---

## Comments

---

## Changelog

### 2026-03-30 20:07 | grimoire

Document created.
