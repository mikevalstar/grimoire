---
id: "feat-fj79e-context-command"
uid: "fj79e"
title: "Context Command"
type: "feature"
status: "proposed"
priority: "critical"
created: "2026-03-29"
updated: "2026-03-29"
tags:
  - core
  - search
  - ai
requirements: []
decisions: []
---

# Context Command — The Killer Feature

The command AI agents call to get oriented. Returns a curated bundle of relevant documents based on a natural language description of what the agent is about to work on.

## Scope

- \`grimoire context <description>\` — hybrid search + relationship traversal to return relevant docs
- Options: \`--limit\`, \`--include-tasks\`, \`--include-decisions\`, \`--depth\`, \`--compact\`, \`--type\`
- Combines semantic search results with relationship graph traversal
- Returns: relevant requirements, parent features, related decisions, open tasks, dependencies — all in one structured JSON response
- Depends on: Search (full-text + semantic) and Relationships/Graph features

## Current Status

Not yet implemented. Depends on search and relationship graph being complete.

---

## Comments

---

## Changelog

### 2026-03-29 19:00 | grimoire

Document created.
