---
id: "req-xoohd-keyword-search-command"
uid: "xoohd"
title: "Keyword Search Command"
type: "requirement"
status: "done"
priority: "high"
feature: "feat-n8gsu-search-full-text-semantic"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-2
  - search
  - cli
tasks: []
depends_on: []
---

# Keyword Search Command

`grimoire search <query>` using BM25 full-text search. Phase 2 delivers keyword search only; semantic/hybrid search is added in Phase 3.

## Acceptance Criteria

- `grimoire search <query>` returns documents ranked by BM25 relevance score
- Supports filters: `--type <type>`, `--status <status>`, `--tag <tag>`, `--limit <n>`
- `--keyword-only` flag available (default behavior in Phase 2)
- Returns JSON array with: id, title, type, status, score, snippet (relevant excerpt)
- Empty results return an empty array (not an error)
- Search queries are case-insensitive
- Handles multi-word queries and partial matches
- Performance: <500ms for typical queries on projects with <200 documents

---

## Comments

---

## Changelog

### 2026-03-30 20:12 | grimoire

Document created.
