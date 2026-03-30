---
id: "req-p230i-import-command"
uid: "p230i"
title: "Import Command"
type: "requirement"
status: "draft"
priority: "medium"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-5
  - cli
  - import
feature: "feat-noxgm-export-import"
tasks: []
depends_on: []
---

# Import Command

## Description

grimoire import <path> — bulk import documents from JSON or markdown files.

## Acceptance Criteria

- grimoire import <path> --format json: import from a JSON file (array of documents)
- grimoire import <path> --format md: import from a directory of markdown files with frontmatter
- --merge: merge with existing documents (update if ID matches, create if new)
- Default behavior: skip documents whose IDs already exist
- Validates imported documents against schemas before writing
- Reports: created count, skipped count, error count
- Human mode (-i): shows diff preview and asks for confirmation before applying
- AI mode: applies immediately, returns JSON result

## Implementation Notes

- JSON import should accept output from grimoire export for round-trip
- Markdown import useful for migrating from hand-written docs into grimoire structure
- Validate frontmatter schemas, generate IDs if missing

---

## Comments

---

## Changelog

### 2026-03-30 19:18 | grimoire

Document created.
