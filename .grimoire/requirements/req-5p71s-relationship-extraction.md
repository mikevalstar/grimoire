---
id: "req-5p71s-relationship-extraction"
uid: "5p71s"
title: "Relationship Extraction"
type: "requirement"
status: "draft"
priority: "high"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-2
  - graph
  - sync
feature: "feat-86vkx-relationships-graph"
tasks: []
depends_on: []
---

# Relationship Extraction

During sync, parse frontmatter link fields and populate the `relationships` table in DuckDB.

## Acceptance Criteria

- Extracts relationships from these frontmatter fields:
  - Feature: `requirements[]`, `decisions[]`
  - Requirement: `feature`, `tasks[]`, `depends_on[]`
  - Task: `requirement`, `feature`, `depends_on[]`
  - Decision: `features[]`, `supersedes`, `superseded_by`
- Maps to relationship types: has_requirement, has_task, has_decision, depends_on, supersedes, parent_feature
- Handles bidirectional relationships (e.g., feature→requirement and requirement→feature)
- Validates that target IDs exist; reports broken links as warnings
- Relationships are cleared and rebuilt on each sync (no stale data)

---

## Comments

---

## Changelog

### 2026-03-30 20:12 | grimoire

Document created.
