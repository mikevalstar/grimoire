---
id: "req-cpsjh-status-command"
uid: "cpsjh"
title: "Status Command"
type: "requirement"
status: "draft"
priority: "medium"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-2
  - cli
  - dashboard
feature: "feat-s46ae-project-status-dashboard"
tasks: []
depends_on: []
---

# Status Command

`grimoire status` provides a project-wide dashboard showing document counts, open tasks, recent changes, and health indicators.

## Acceptance Criteria

- Returns document counts by type (features, requirements, tasks, decisions)
- Returns document counts by status within each type
- Lists recently updated documents (default: 10, configurable via `--limit`)
- Reports open task count and blocked task count
- Reports orphaned document count
- Reports stale documents (not updated in >30 days, configurable)
- JSON output includes all counts and lists for AI consumption
- Human mode shows a formatted, color-coded dashboard
- Requires database to be synced (triggers auto-sync if enabled)

---

## Comments

---

## Changelog

### 2026-03-30 20:12 | grimoire

Document created.
