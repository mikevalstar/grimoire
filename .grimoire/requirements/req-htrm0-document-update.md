---
id: "req-htrm0-document-update"
uid: "htrm0"
title: "Document Update"
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

# Document Update

**Parent Feature:** feat-7mi1w — Document CRUD Operations

## Description

`grimoire <type> update <id>` modifies a document's frontmatter fields and/or body content while preserving the Comments and Changelog sections.

## Acceptance Criteria

- Supports updating: `--title`, `--status`, `--priority`, `--add-tag`, `--remove-tag`, `--body`
- Preserves existing Comments and Changelog sections when body is updated
- Updates the `updated` field in frontmatter automatically
- Accepts full ID or UID
- Returns the updated document as JSON

---

## Comments

---

## Changelog

### 2026-03-30 20:07 | grimoire

Document created.
