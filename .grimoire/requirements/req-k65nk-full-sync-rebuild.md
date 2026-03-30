---
id: "req-k65nk-full-sync-rebuild"
uid: "k65nk"
title: "Full Sync Rebuild"
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

# Full Sync Rebuild

`grimoire sync` parses all markdown files in `.grimoire/` and populates the DuckDB database from scratch.

## Acceptance Criteria

- Scans all `.grimoire/**/*.md` files (features, requirements, tasks, decisions, overview)
- Parses YAML frontmatter and markdown body for each file
- Inserts/updates rows in the `documents` table
- Extracts changelog and comment sections into `changelog_entries` table
- Extracts frontmatter link fields into `relationships` table
- Reports sync results: files processed, rows inserted/updated, errors
- JSON output in AI mode with counts and any errors
- Handles malformed files gracefully (reports errors, continues sync)

---

## Comments

---

## Changelog

### 2026-03-30 20:11 | grimoire

Document created.
