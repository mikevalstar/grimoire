---
id: "req-16550-document-listing"
uid: "16550"
title: "Document Listing"
type: "requirement"
status: "done"
priority: "high"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - crud
feature: "feat-7mi1w-document-crud-operations"
tasks: []
depends_on: []
---

# Document Listing

**Parent Feature:** feat-7mi1w — Document CRUD Operations

## Description

`grimoire <type> list` scans the filesystem and returns all documents of a given type with summary information.

## Acceptance Criteria

- Lists all documents in the corresponding `.grimoire/{type}s/` directory
- Returns count and array of document summaries (id, uid, title, status, priority, updated, filepath)
- Works for all four document types
- Filesystem-based (no database required)

---

## Comments

---

## Changelog

### 2026-03-30 20:07 | grimoire

Document created.
