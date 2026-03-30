---
id: "req-fwlnl-document-creation"
uid: "fwlnl"
title: "Document Creation"
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

# Document Creation

**Parent Feature:** feat-7mi1w — Document CRUD Operations

## Description

`grimoire <type> create` generates a new markdown document with auto-generated ID (type prefix + nanoid + title slug), YAML frontmatter populated from flags, and empty Comments/Changelog sections.

## Acceptance Criteria

- Supports all four document types: feature, requirement, task, decision
- `--title` is required; errors if missing
- Auto-generates ID in format `{prefix}-{nanoid}-{slug}` (e.g., `feat-a3f2k-user-auth`)
- Sets frontmatter fields from flags: `--status`, `--priority`, `--tag`, `--feature`, `--requirement`
- `--body` flag or stdin sets the body content
- Creates file at `.grimoire/{type}s/{id}.md`
- Returns the created document as JSON

---

## Comments

---

## Changelog

### 2026-03-30 20:07 | grimoire

Document created.
