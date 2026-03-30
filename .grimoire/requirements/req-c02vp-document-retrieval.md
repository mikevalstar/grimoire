---
id: "req-c02vp-document-retrieval"
uid: "c02vp"
title: "Document Retrieval"
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

# Document Retrieval

**Parent Feature:** feat-7mi1w — Document CRUD Operations

## Description

`grimoire <type> get <id>` finds and returns a document by full ID or UID (short nanoid portion). Scans the filesystem to locate the matching file.

## Acceptance Criteria

- Accepts full ID (e.g., `feat-a3f2k-user-auth`) or UID (e.g., `a3f2k`)
- Returns full document content as structured JSON: frontmatter fields, body, comments, changelog
- Returns meaningful error if document not found
- Works for all four document types

---

## Comments

---

## Changelog

### 2026-03-30 20:07 | grimoire

Document created.
