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

Check project documents for structural issues — broken links, missing required fields, orphaned documents, and schema violations.

## Scope

- \`grimoire validate\` — runs all validation checks and reports issues
- Broken link detection (references to non-existent document IDs)
- Missing required fields (e.g., title, type)
- Orphaned documents (no incoming or outgoing relationships)
- Schema validation (valid status values, valid priority levels, correct type prefixes)

## Current Status

Validate command exists but needs verification of completeness.

---

## Comments

---

## Changelog

### 2026-03-29 19:01 | grimoire

Document created.
