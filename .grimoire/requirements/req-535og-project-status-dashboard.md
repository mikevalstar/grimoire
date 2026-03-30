---
id: "req-535og-project-status-dashboard"
uid: "535og"
title: "Project Status Dashboard"
type: "requirement"
status: "done"
priority: "high"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - dashboard
  - frontend
feature: "feat-fv5ft-web-ui"
tasks: []
depends_on: []
---

# Project Status Dashboard

## Description

A web-based project dashboard showing document counts, status breakdowns, health indicators, and recent updates.

## Acceptance Criteria

- Home page (/) renders the status dashboard
- Document counts by type (features, requirements, tasks, decisions)
- Status breakdown per document type with color-coded badges
- Task health: open and blocked task counts
- Health indicators: orphaned documents, stale documents (>30 days)
- Recent updates table with type, title, status, and timestamp
- Data fetched from GET /api/status endpoint

## Implementation Notes

- Component at apps/website/src/components/status-dashboard.tsx
- Backed by status() from @grimoire-ai/core
- Color-coded badges: blue=in-progress, yellow=draft/todo, green=done, red=blocked, gray=deprecated

---

## Comments

---

## Changelog

### 2026-03-30 07:42 | grimoire

Document created.
