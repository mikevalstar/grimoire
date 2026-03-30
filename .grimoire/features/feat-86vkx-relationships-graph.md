---
id: "feat-86vkx-relationships-graph"
uid: "86vkx"
title: "Relationships & Graph"
type: "feature"
status: "proposed"
priority: "high"
created: "2026-03-29"
updated: "2026-03-30"
tags:
  - core
  - graph
  - phase-2
requirements:
  - req-5p71s-relationship-extraction
  - req-h60rj-links-command
  - req-oxole-tree-command
  - req-modzf-orphans-command
decisions: []
---

# Relationships & Graph

**Why:** Documents in isolation lack context. Agents need to traverse from a task up to its parent requirement and feature, or discover related decisions, to understand the full picture before making changes.

## Scope

- `grimoire links <id>` — show all relationships for a document, with `--direction`, `--type`, `--depth`
- `grimoire tree` — show feature → requirement → task hierarchy, with `--feature`, `--status`, `--collapsed`
- `grimoire orphans` — find documents with no relationships
- Relationship types: has_requirement, has_task, has_decision, depends_on, supersedes, parent_feature
- Stored in `relationships` DuckDB table, derived from frontmatter links during sync

## Acceptance criteria

- `links` command returns all direct and transitive relationships up to specified depth
- `tree` command renders the full hierarchy filtered by feature/status
- `orphans` finds documents with zero relationships
- Relationships are correctly extracted from frontmatter during sync

## Non-goals

- No visual graph rendering in CLI (that's the Web UI's job)
- No custom/user-defined relationship types
