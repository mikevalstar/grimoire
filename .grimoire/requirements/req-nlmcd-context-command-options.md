---
id: "req-nlmcd-context-command-options"
uid: "nlmcd"
title: "Context Command Options"
type: "requirement"
status: "draft"
priority: "high"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-4
  - context
  - cli
feature: "feat-fj79e-context-command"
tasks: []
depends_on: []
---

# Context Command Options

## Description

CLI flags for the context command to control what's included in the returned context bundle.

## Acceptance Criteria

- --limit <n>: max documents to return (default: 10)
- --depth <n>: relationship traversal depth (default: 2)
- --compact: return summaries (title + first paragraph) instead of full bodies
- --type <type>: filter results by document type
- --include-tasks: include open tasks in results (default: exclude tasks for conciseness)
- --include-decisions: include relevant decisions in results
- All flags documented in --help and SKILL.md
- Flags composable (e.g., --compact --include-tasks --type requirement)

## Implementation Notes

- Defaults should optimize for concise, relevant output — agents can always ask for more
- --compact is important for keeping context window usage low

---

## Comments

---

## Changelog

### 2026-03-30 19:17 | grimoire

Document created.
