---
id: "req-6z84c-editor-integration-for-document-editing"
uid: "6z84c"
title: "Editor Integration for Document Editing"
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

# Editor Integration for Document Editing

## Description

grimoire <type> edit <id> — open a document in \$EDITOR for full editing (frontmatter + body), then validate and re-sync on save.

## Acceptance Criteria

- grimoire feature edit <id> opens the markdown file in \$EDITOR
- Full file opened: YAML frontmatter + markdown body + comments + changelog
- On editor close: validate the file (frontmatter schema, required fields)
- If validation passes: re-sync document to DuckDB
- If validation fails: show errors and offer to re-open editor or discard changes
- grimoire overview edit opens overview.md in \$EDITOR
- Works with common editors: vim, nano, code --wait, subl --wait

## Implementation Notes

- Use child_process.spawn with stdio: inherit for editor
- Detect editor from \$VISUAL, \$EDITOR, or fallback
- Save original content to restore on discard

---

## Comments

---

## Changelog

### 2026-03-30 19:18 | grimoire

Document created.
