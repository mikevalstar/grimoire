---
id: "req-oxole-tree-command"
uid: "oxole"
title: "Tree Command"
type: "requirement"
status: "draft"
priority: "medium"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-2
  - graph
  - cli
feature: "feat-86vkx-relationships-graph"
tasks: []
depends_on: []
---

# Tree Command

`grimoire tree` displays the feature → requirement → task hierarchy.

## Acceptance Criteria

- Renders the full hierarchy: features at top, requirements nested under their parent features, tasks nested under their parent requirements
- `--feature <feature-id>` shows tree for a specific feature only
- `--status <status>` filters nodes by status
- `--collapsed` shows IDs and titles only (no body/metadata)
- JSON output is a nested tree structure with children arrays
- Documents without parent links appear at the root level
- Handles circular dependencies gracefully (does not infinite loop)

---

## Comments

---

## Changelog

### 2026-03-30 20:12 | grimoire

Document created.
