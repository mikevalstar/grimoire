---
id: "feat-dqul2-interactive-mode"
uid: "dqul2"
title: "Interactive Mode"
type: "feature"
status: "proposed"
priority: "high"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-5
  - cli
  - ux
requirements:
  - req-5tz6w-interactive-flag-for-all-commands
  - req-35ys4-interactive-document-creation
  - req-6z84c-editor-integration-for-document-editing
decisions: []
---

# Interactive Mode

**Why:** The CLI is designed for AI agents by default, but humans need a friendly interactive experience with prompts, editor integration, and color output. The -i flag transforms grimoire from an agent tool into a human-friendly CLI.

## Scope

- Global --interactive (-i) flag for all commands: prompts, confirmations, color-coded output
- grimoire <type> new — interactive document creation with guided prompts and \$EDITOR for body
- grimoire <type> edit <id> — open full document (frontmatter + body) in \$EDITOR, re-sync on save

## Acceptance criteria

- -i flag enables interactive prompts, confirmations, and formatted color output on all commands
- grimoire feature new (interactive) prompts for title, status, priority, tags, then opens \$EDITOR
- grimoire task edit <id> opens the markdown file in \$EDITOR, validates on save
- All interactive commands have non-interactive equivalents (flags-only) for AI mode

## Non-goals

- No TUI (terminal UI) — just prompts and editor integration
- No custom editor — uses \$EDITOR or falls back to vi/nano

---

## Comments

---

## Changelog

### 2026-03-30 19:17 | grimoire

Document created.
