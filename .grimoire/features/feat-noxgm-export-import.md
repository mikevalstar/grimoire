---
id: "feat-noxgm-export-import"
uid: "noxgm"
title: "Export & Import"
type: "feature"
status: "proposed"
priority: "low"
created: "2026-03-29"
updated: "2026-03-29"
tags:
  - cli
requirements: []
decisions: []
---

# Export & Import

**Why:** Teams need to share project knowledge with stakeholders who don't use grimoire, and migrate existing requirements from other tools. Export/import bridges the gap between grimoire's markdown files and external formats.

## Scope

- `grimoire export` — export to JSON, CSV, or Markdown summary, with `--type` and `--output` filters
- `grimoire import <path>` — import from JSON or Markdown, with `--merge` option
- Human mode: shows diff preview, asks for confirmation before import

## Acceptance criteria

- Export produces valid JSON, CSV, and Markdown output
- Import creates documents with correct frontmatter and relationships
- `--merge` option handles conflicts with existing documents
- Human mode shows preview before applying import

## Non-goals

- No integration with specific external tools (Jira, Linear, etc.)
- No streaming/incremental export
