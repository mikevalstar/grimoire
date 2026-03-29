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

The DuckDB database is a derived cache rebuilt from markdown files. It stores documents, relationships, and changelog entries for fast querying.

## Scope

- \`grimoire sync\` — rebuild DuckDB from markdown files, with \`--force\` (full rebuild) and \`--dry-run\`
- Auto-sync on CLI commands if files changed (configurable)
- Three tables: documents (id, title, type, status, priority, tags, body, embedding, frontmatter JSON), relationships (source_id, target_id, relationship type), changelog_entries (document_id, date, author, content, is_comment)
- Relationship extraction from frontmatter links (requirements, tasks, decisions, depends_on, supersedes, feature)
- Database lives at \`.grimoire/.cache/grimoire.duckdb\` (gitignored)

## Current Status

Basic sync is implemented. Document table population works. Relationship extraction and changelog entry parsing need verification.

---

## Comments

---

## Changelog

### 2026-03-29 19:00 | grimoire

Document created.
