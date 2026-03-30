---
id: "req-orvg4-document-validation"
uid: "orvg4"
title: "Document Validation"
type: "requirement"
status: "done"
priority: "medium"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - validation
feature: "feat-j4al2-validation"
tasks: []
depends_on: []
---

# Document Validation

**Parent Feature:** feat-j4al2 — Validation

## Description

`grimoire validate` performs comprehensive checks across all grimoire documents to catch structural issues and inconsistencies.

## Acceptance Criteria

- Checks YAML frontmatter against schemas for each document type
- Validates required fields are present and non-empty
- Detects broken links (references to non-existent document IDs)
- Identifies orphaned documents (no incoming or outgoing relationships)
- Flags ID/filename mismatches
- Returns structured JSON with errors, warnings, and summary counts
- Exit code reflects validation result (0 = pass, 1 = failures)

---

## Comments

---

## Changelog

### 2026-03-30 20:08 | grimoire

Document created.
