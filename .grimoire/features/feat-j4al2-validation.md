---
id: "feat-j4al2-validation"
uid: "j4al2"
title: "Validation"
type: "feature"
status: "in-progress"
priority: "medium"
created: "2026-03-29"
updated: "2026-03-29"
tags:
  - core
  - cli
requirements: []
decisions: []
---

# Validation

**Why:** Markdown files are hand-editable and relationships are stored as string references — things break silently. Validation catches broken links, missing fields, and schema violations before they cause confusing downstream errors.

## Scope

- `grimoire validate` — runs all validation checks and reports issues
- Broken link detection (references to non-existent document IDs)
- Missing required fields (e.g., title, type)
- Orphaned documents (no incoming or outgoing relationships)
- Schema validation (valid status values, valid priority levels, correct type prefixes)

## Acceptance criteria

- Detects and reports all broken relationship links
- Catches missing required frontmatter fields
- Identifies orphaned documents
- Validates status/priority values against allowed enums
- Returns exit code 1 on errors, 0 on clean

## Non-goals

- No auto-fix mode (report only)
- No content quality checks (spelling, grammar)
