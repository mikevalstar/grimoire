---
id: "req-9a7o0-duckdb-setup-schema"
uid: "9a7o0"
title: "DuckDB Setup & Schema"
type: "requirement"
status: "draft"
priority: "high"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-2
  - database
feature: "feat-vcodc-duckdb-sync-database"
tasks: []
depends_on: []
---

# DuckDB Setup & Schema

Set up DuckDB via `duckdb-async` and create the three core tables: `documents`, `relationships`, and `changelog_entries`.

## Acceptance Criteria

- DuckDB database created at `.grimoire/.cache/grimoire.duckdb`
- `documents` table with columns: id (PK), title, type, status, priority, created, updated, tags (VARCHAR[]), filepath, body (TEXT), embedding (FLOAT[768]), frontmatter (JSON)
- `relationships` table with columns: source_id, target_id, relationship type; composite PK on all three
- `changelog_entries` table with columns: id (PK), document_id (FK), date, author, content, is_comment
- Foreign key constraints between tables
- Database is gitignored via `.grimoire/.cache/`
- Database can be deleted and recreated without data loss (derived from markdown files)

---

## Comments

---

## Changelog

### 2026-03-30 20:11 | grimoire

Document created.
