---
id: "req-i321l-export-command"
uid: "i321l"
title: "Export Command"
type: "requirement"
status: "draft"
priority: "medium"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-5
  - cli
  - export
feature: "feat-noxgm-export-import"
tasks: []
depends_on: []
---

# Export Command

## Description

grimoire export — export project documents to JSON, CSV, or markdown summary formats.

## Acceptance Criteria

- grimoire export --format json: exports all documents as structured JSON array
- grimoire export --format csv: exports documents as CSV (one row per document, frontmatter fields as columns)
- grimoire export --format md: exports a markdown summary document with document listings grouped by type
- --type <type>: filter export to a specific document type
- --output <path>: write to file instead of stdout
- Default format is JSON
- Exported JSON is re-importable via grimoire import
- Relationships included in JSON export

## Implementation Notes

- JSON export should match the internal document structure for round-trip fidelity
- CSV needs flattening of arrays (tags, relationships) into delimited strings
- Markdown summary should be human-readable — good for sharing in PRs or docs

---

## Comments

---

## Changelog

### 2026-03-30 19:18 | grimoire

Document created.
