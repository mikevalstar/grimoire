---
id: "req-tzoe9-auto-sync-on-cli-commands"
uid: "tzoe9"
title: "Auto-Sync on CLI Commands"
type: "requirement"
status: "done"
priority: "medium"
feature: "feat-vcodc-duckdb-sync-database"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-2
  - sync
tasks: []
depends_on: []
---

# Auto-Sync on CLI Commands

Automatically trigger an incremental sync before CLI commands that read from the database, when markdown files have changed since the last sync.

## Acceptance Criteria

- Detects when markdown files are newer than the last sync timestamp
- Triggers incremental sync transparently before database-reading commands (search, list with filters, links, tree, orphans, status)
- Does not trigger on write commands that already update the database (create, update, delete)
- Configurable via `sync.auto_sync` in `config.yaml` (default: true)
- Auto-sync adds minimal overhead (<100ms) when no files have changed
- Sync errors during auto-sync are reported as warnings, not fatal errors

---

## Comments

---

## Changelog

### 2026-03-30 20:12 | grimoire

Document created.
