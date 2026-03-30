---
id: "req-h60rj-links-command"
uid: "h60rj"
title: "Links Command"
type: "requirement"
status: "done"
priority: "high"
feature: "feat-86vkx-relationships-graph"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-2
  - graph
  - cli
tasks: []
depends_on: []
---

# Links Command

`grimoire links <id>` shows all relationships for a document with filtering and traversal depth control.

## Acceptance Criteria

- Returns all relationships where the document is source or target
- `--direction <in|out|both>` filters by link direction (default: both)
- `--type <relationship-type>` filters by relationship type
- `--depth <n>` controls traversal depth (default: 1, max: 5)
- Depth > 1 recursively follows relationships to show transitive connections
- JSON output includes: related document id, title, type, status, relationship type, direction, depth level
- Returns empty array if document has no relationships
- Errors if document ID is not found

---

## Comments

---

## Changelog

### 2026-03-30 20:12 | grimoire

Document created.
