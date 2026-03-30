---
id: "req-5tz6w-interactive-flag-for-all-commands"
uid: "5tz6w"
title: "Interactive Flag for All Commands"
type: "requirement"
status: "draft"
priority: "high"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-5
  - cli
  - ux
feature: "feat-dqul2-interactive-mode"
tasks: []
depends_on: []
---

# Interactive Flag for All Commands

## Description

Add a global --interactive (-i) flag that switches CLI output from JSON to human-friendly formatted output with color coding, prompts, and confirmations.

## Acceptance Criteria

- -i / --interactive flag available on all commands
- Interactive mode: color-coded output, human-readable formatting, confirmation prompts for destructive ops
- AI mode (default, no -i): JSON output, no prompts, all input via flags — unchanged from current behavior
- Status badges color-coded (green=done, amber=in-progress, red=blocked)
- Priority color-coded (red=critical, orange=high)
- Tables formatted with aligned columns for list commands
- Error messages formatted with context and suggestions

## Implementation Notes

- Consider chalk or similar for color output
- Could use a shared output formatter that switches based on mode

---

## Comments

---

## Changelog

### 2026-03-30 19:18 | grimoire

Document created.
