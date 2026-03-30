---
id: "req-wh7lk-duckdb-backed-list-with-filters"
uid: "wh7lk"
title: "DuckDB-Backed List with Filters"
type: "requirement"
status: "draft"
priority: "high"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-2
  - cli
  - database
feature: "feat-vcodc-duckdb-sync-database"
tasks: []
depends_on: []
---

# DuckDB-Backed List with Filters

Upgrade `grimoire <type> list` to query DuckDB instead of scanning the filesystem, enabling efficient filtering and sorting.

## Acceptance Criteria

- `grimoire <type> list` queries the `documents` table instead of scanning filesystem
- `--status <status>` filters by document status
- `--priority <priority>` filters by priority level
- `--tag <tag>` filters by tag (repeatable for AND logic)
- `--feature <feature-id>` filters requirements/tasks by parent feature
- `--limit <n>` limits result count
- `--sort <field>` sorts by field (default: updated, options: created, title, priority, status)
- Falls back to filesystem scan if database is not available or out of date
- Performance: <100ms for filtered list queries

---

## Comments

---

## Changelog

### 2026-03-30 20:12 | grimoire

Document created.
