---
id: "req-a5lk8-context-command-core"
uid: "a5lk8"
title: "Context Command Core"
type: "requirement"
status: "draft"
priority: "critical"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-4
  - context
  - ai
feature: "feat-fj79e-context-command"
tasks: []
depends_on: []
---

# Context Command Core

## Description

Implement grimoire context <description> — the killer feature. Given a natural language description of what an agent is about to work on, return a curated bundle of relevant documents found via hybrid search + relationship graph traversal.

## Acceptance Criteria

- grimoire context "description" performs hybrid search for the description
- Traverses relationships from search hits to pull in connected documents (configurable depth)
- Returns structured JSON bundle: { features: [], requirements: [], tasks: [], decisions: [] }
- Each document in the bundle includes id, title, status, priority, and body (or summary in compact mode)
- Deduplicates documents found via multiple paths
- Respects --limit for total document count
- Performance under 2s for typical projects (<200 documents)

## Implementation Notes

- Start with search hits, then BFS/DFS through relationships table up to --depth
- Core logic in packages/core, thin CLI wrapper in apps/cli
- Depends on hybrid search being available (falls back to keyword-only if no embeddings)

---

## Comments

---

## Changelog

### 2026-03-30 19:17 | grimoire

Document created.
