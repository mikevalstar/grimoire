---
id: "feat-vcodc-duckdb-sync-database"
uid: "vcodc"
title: "DuckDB Sync & Database"
type: "feature"
status: "in-progress"
priority: "high"
created: "2026-03-29"
updated: "2026-03-29"
tags:
  - core
  - database
requirements: []
decisions: []
---

# DuckDB Sync & Database

**Why:** Markdown files are the source of truth but too slow for search and graph queries. The DuckDB cache gives us full-text search, vector similarity, and relational queries without sacrificing the file-first model.

## Scope

- `grimoire sync` — rebuild DuckDB from markdown files, with `--force` (full rebuild) and `--dry-run`
- Auto-sync on CLI commands if files changed (configurable)
- Three tables: documents, relationships, changelog_entries
- Relationship extraction from frontmatter links during sync
- Database lives at `.grimoire/.cache/grimoire.duckdb` (gitignored)

## Acceptance criteria

- Sync populates all three tables from markdown files
- `--force` does a full rebuild; default is incremental (changed files only)
- `--dry-run` reports what would change without writing
- Auto-sync triggers when markdown files are newer than the database
- Relationships are correctly extracted from all frontmatter link fields

## Non-goals

- No write-back from database to markdown (one-way sync only)
- No external database support (DuckDB only)
- No concurrent access handling (single-user tool)
