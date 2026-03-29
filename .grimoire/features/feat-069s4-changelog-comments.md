---
id: "feat-069s4-changelog-comments"
uid: "069s4"
title: "Changelog & Comments"
type: "feature"
status: "in-progress"
priority: "medium"
created: "2026-03-29"
updated: "2026-03-29"
tags:
  - core
  - cli
requirements: []
decisions: []
---

# Changelog & Comments

AI agents and humans can append timestamped entries to any document's changelog or comments section. This is how progress gets recorded and questions get asked.

## Scope

- \`grimoire log <id> <message>\` — append a changelog entry with optional \`--author\`
- \`grimoire comment <id> <message>\` — append a blockquoted comment (shorthand for \`log --comment\`)
- Entries follow the format: \`### YYYY-MM-DD HH:mm | author\`
- Comments are blockquoted (\`>\`), changelog entries are plain text
- Both sections are included in embedded content for semantic search

## Current Status

Log and comment commands are implemented.

---

## Comments

---

## Changelog

### 2026-03-29 19:00 | grimoire

Document created.
