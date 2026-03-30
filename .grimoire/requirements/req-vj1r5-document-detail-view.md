---
id: "req-vj1r5-document-detail-view"
uid: "vj1r5"
title: "Document Detail View"
type: "requirement"
status: "done"
priority: "high"
feature: "feat-fv5ft-web-ui"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - frontend
  - documents
  - markdown
tasks: []
depends_on: []
---

# Document Detail View

## Description

A detail page for viewing a single document with rendered markdown body and frontmatter metadata sidebar.

## Acceptance Criteria

- Route at /documents/:id
- Rendered markdown body (not raw source)
- Frontmatter sidebar showing: title, type, status, priority, tags, dates, relationships
- Relationship links are clickable (navigate to linked documents)
- Comments and changelog sections rendered with proper formatting
- Breadcrumb navigation (e.g., Feature > Requirement > Task)
- Back navigation to list view

## Dependencies

- Requires REST API for Core Operations (document get endpoint)
- Needs a markdown rendering library (e.g., react-markdown, remark)

---

## Comments

---

## Changelog

### 2026-03-30 07:43 | grimoire

Document created.
