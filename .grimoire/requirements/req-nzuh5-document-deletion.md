---
id: "req-nzuh5-document-deletion"
uid: "nzuh5"
title: "Document Deletion"
type: "requirement"
status: "done"
priority: "medium"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - crud
feature: "feat-7mi1w-document-crud-operations"
tasks: []
depends_on: []
---

# Document Deletion

**Parent Feature:** feat-7mi1w — Document CRUD Operations

## Description

`grimoire <type> delete <id>` archives a document by moving it to `.grimoire/.archive/` rather than permanently deleting it.

## Acceptance Criteria

- Moves the document file to `.grimoire/.archive/{type}s/`
- Creates `.archive/` subdirectory if it doesn't exist
- `--hard` flag permanently deletes instead of archiving
- `--confirm` flag required in AI mode to skip confirmation
- Returns success/failure as JSON

---

## Comments

---

## Changelog

### 2026-03-30 20:07 | grimoire

Document created.
