---
id: "req-modzf-orphans-command"
uid: "modzf"
title: "Orphans Command"
type: "requirement"
status: "done"
priority: "medium"
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

# Orphans Command

`grimoire orphans` finds documents with no relationships to any other document.

## Acceptance Criteria

- Queries the `relationships` table to find documents that appear in neither source_id nor target_id
- Returns list of orphaned documents with: id, title, type, status, filepath
- Supports `--type <type>` filter to check orphans within a document type
- JSON output for AI mode
- The overview document is excluded from orphan detection (it is intentionally standalone)

---

## Comments

---

## Changelog

### 2026-03-30 20:12 | grimoire

Document created.
