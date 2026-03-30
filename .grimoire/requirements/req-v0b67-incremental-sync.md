---
id: "req-v0b67-incremental-sync"
uid: "v0b67"
title: "Incremental Sync"
type: "requirement"
status: "done"
priority: "high"
feature: "feat-vcodc-duckdb-sync-database"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-2
  - sync
tasks: []
depends_on: []
---

# Incremental Sync

Content-hash based incremental sync that only re-processes changed files, making sync fast for day-to-day usage.

## Acceptance Criteria

- Computes content hash for each markdown file
- Stores content hashes in DuckDB or a sidecar file
- On sync, compares current file hashes against stored hashes
- Only re-processes files whose content has changed
- Detects deleted files and removes their rows from all tables
- Detects new files and inserts them
- Performance: incremental sync should complete in <200ms when no files have changed
- Falls back to full rebuild if hash store is missing or corrupted

---

## Comments

---

## Changelog

### 2026-03-30 20:12 | grimoire

Document created.
