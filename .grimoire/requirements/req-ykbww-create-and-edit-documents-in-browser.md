---
id: "req-ykbww-create-and-edit-documents-in-browser"
uid: "ykbww"
title: "Create and Edit Documents in Browser"
type: "requirement"
status: "draft"
priority: "medium"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - frontend
  - documents
  - editing
feature: "feat-fv5ft-web-ui"
tasks: []
depends_on: []
---

# Create and Edit Documents in Browser

## Description

Forms for creating new documents and editing existing ones directly in the web UI.

## Acceptance Criteria

- Create form accessible from list views and navigation
- Document type selector with type-appropriate fields
- Form fields for all frontmatter: title, status, priority, tags, relationships
- Markdown editor for body content (textarea with preview or split-pane)
- Edit mode on document detail view to modify existing documents
- Inline status/priority updates without full edit form
- Validation feedback matching grimoire validate rules
- Changes written to markdown files on disk (via API)

## Dependencies

- Requires REST API for Core Operations (create and update endpoints)
- Requires Document Detail View for edit-in-place

---

## Comments

---

## Changelog

### 2026-03-30 07:43 | grimoire

Document created.
