---
id: "feat-vcodc-duckdb-sync-database"
uid: "vcodc"
title: "DuckDB Sync & Database"
type: "feature"
status: "in-progress"
priority: "high"
created: "2026-03-29"
updated: "2026-03-30"
tags:
  - core
  - database
  - phase-2
requirements:
  - req-9a7o0-duckdb-setup-schema
  - req-k65nk-full-sync-rebuild
  - req-v0b67-incremental-sync
  - req-u9fim-sync-cli-flags
  - req-tzoe9-auto-sync-on-cli-commands
  - req-wh7lk-duckdb-backed-list-with-filters
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
- Upgrade `grimoire <type> list` to query DuckDB with filters

## Acceptance criteria

- Sync populates all three tables from markdown files
- `--force` does a full rebuild; default is incremental (changed files only)
- `--dry-run` reports what would change without writing
- Auto-sync triggers when markdown files are newer than the database
- Relationships are correctly extracted from all frontmatter link fields
- List command uses DuckDB for filtered/sorted queries

## Non-goals

- No write-back from database to markdown (one-way sync only)
- No external database support (DuckDB only)
- No concurrent access handling (single-user tool)
