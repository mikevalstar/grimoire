---
id: "feat-s46ae-project-status-dashboard"
uid: "s46ae"
title: "Project Status Dashboard"
type: "feature"
status: "complete"
priority: "medium"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-2
  - core
  - dashboard
requirements:
  - req-cpsjh-status-command
decisions: []
---

# Project Status Dashboard

**Why:** Users and agents need a quick snapshot of the project state — document counts, open tasks, recent changes, and health indicators — without reading individual documents.

## Scope

- `grimoire status` command providing project-wide summary
- Document counts by type and status
- Recent changes list (most recently updated documents)
- Open/blocked task counts
- Health indicators (orphaned docs, stale items)
- AI mode: JSON summary with counts, lists, staleness indicators
- Human mode: formatted dashboard with color-coded status

## Acceptance criteria

- Returns counts for all document types grouped by status
- Lists recently updated documents (configurable limit)
- Reports open and blocked task counts
- Identifies stale documents (not updated in configurable period)
- JSON output for AI mode, formatted output for human mode

## Non-goals

- No charts or visualizations (that is the Web UI)
- No historical trending data

---

## Comments

---

## Changelog

### 2026-03-30 20:11 | grimoire

Document created.
