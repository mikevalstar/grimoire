---
id: "feat-86vkx-relationships-graph"
uid: "86vkx"
title: "Relationships & Graph"
type: "feature"
status: "proposed"
priority: "high"
created: "2026-03-29"
updated: "2026-03-29"
tags:
  - core
  - graph
requirements: []
decisions: []
---

# Relationships & Graph

Document relationship tracking and graph traversal. Documents link to each other via frontmatter references (features → requirements → tasks, decisions → features, depends_on chains).

## Scope

- \`grimoire links <id>\` — show all relationships for a document, with \`--direction\`, \`--type\`, \`--depth\`
- \`grimoire tree\` — show the feature → requirement → task hierarchy, with \`--feature\`, \`--status\`, \`--collapsed\`
- \`grimoire orphans\` — find documents with no relationships
- Relationship types: has_requirement, has_task, has_decision, depends_on, supersedes, parent_feature
- Stored in the \`relationships\` DuckDB table, derived from frontmatter links during sync

## Current Status

Not yet implemented. Relationship extraction during sync may be partially in place.

---

## Comments

---

## Changelog

### 2026-03-29 19:01 | grimoire

Document created.
