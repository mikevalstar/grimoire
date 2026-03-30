---
id: "req-u9fim-sync-cli-flags"
uid: "u9fim"
title: "Sync CLI Flags"
type: "requirement"
status: "done"
priority: "medium"
feature: "feat-vcodc-duckdb-sync-database"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-2
  - sync
  - cli
tasks: []
depends_on: []
---

# Sync CLI Flags

`--force` and `--dry-run` flags for the `grimoire sync` command to give users control over sync behavior.

## Acceptance Criteria

- `--force` flag triggers a full rebuild regardless of content hashes (drops and recreates all tables)
- `--dry-run` flag reports what would change without writing to the database
- `--dry-run` output includes: files that would be added, updated, or removed
- Both flags work together (`--force --dry-run` shows full rebuild plan)
- JSON output in AI mode for both flags

---

## Comments

---

## Changelog

### 2026-03-30 20:12 | grimoire

Document created.
