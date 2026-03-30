---
id: "req-syd6t-fts-index-setup"
uid: "syd6t"
title: "FTS Index Setup"
type: "requirement"
status: "done"
priority: "high"
feature: "feat-n8gsu-search-full-text-semantic"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-2
  - search
  - fts
tasks: []
depends_on: []
---

# FTS Index Setup

Configure DuckDB full-text search (FTS) extension for BM25-ranked keyword search across documents.

## Acceptance Criteria

- DuckDB `fts` extension loaded during database setup
- FTS index created on `documents` table covering `title`, `body`, and `tags` columns
- Index is rebuilt during full sync and incrementally updated during incremental sync
- BM25 ranking scores are returned with search results
- Index handles special characters and markdown syntax gracefully

---

## Comments

---

## Changelog

### 2026-03-30 20:12 | grimoire

Document created.
