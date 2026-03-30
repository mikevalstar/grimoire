---
id: "req-35ys4-interactive-document-creation"
uid: "35ys4"
title: "Interactive Document Creation"
type: "requirement"
status: "draft"
priority: "high"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-5
  - cli
  - editing
feature: "feat-dqul2-interactive-mode"
tasks: []
depends_on: []
---

# Interactive Document Creation

## Description

grimoire <type> new — interactive document creation that prompts for metadata and opens \$EDITOR for body content.

## Acceptance Criteria

- grimoire feature new prompts for: title, status, priority, tags
- grimoire requirement new additionally prompts for: parent feature (with autocomplete/list)
- grimoire task new additionally prompts for: parent requirement, parent feature, assignee
- After metadata prompts, opens \$EDITOR with a template (frontmatter pre-filled, body placeholder)
- Shows preview of created document and confirms before saving
- Respects \$EDITOR env var, falls back to vi
- Creates the markdown file and syncs to DuckDB on save

## Implementation Notes

- Use inquirer, prompts, or similar for interactive prompts
- Template should include helpful comments that get stripped on save

---

## Comments

---

## Changelog

### 2026-03-30 19:18 | grimoire

Document created.
