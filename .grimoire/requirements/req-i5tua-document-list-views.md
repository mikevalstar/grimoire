---
id: "req-i5tua-document-list-views"
uid: "i5tua"
title: "Document List Views"
type: "requirement"
status: "done"
priority: "high"
feature: "feat-fv5ft-web-ui"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - frontend
  - documents
tasks: []
depends_on: []
---

# Document List Views

## Description

Browsable, filterable, sortable list views for each document type in the web UI.

## Acceptance Criteria

- Routes for /documents and /documents/:type (feature, requirement, task, decision)
- Table or card view showing title, status, priority, tags, updated date
- Filter by status, priority, and tags
- Sortable by title, status, priority, updated date
- Click-through to document detail view
- Color-coded status badges consistent with dashboard
- Empty states when no documents match filters

## Dependencies

- Requires REST API for Core Operations (document list endpoint)

---

## Comments

---

## Changelog

### 2026-03-30 07:43 | grimoire

Document created.
