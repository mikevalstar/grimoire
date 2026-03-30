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
  - phase-4
requirements:
  - req-a5lk8-context-command-core
  - req-nlmcd-context-command-options
decisions: []
---

# Context Command

**Why:** AI agents waste context window and time reading irrelevant documents. This command gives them exactly the documents they need for a task in one call, making grimoire the bridge between "I need to work on X" and "here's everything you need to know."

## Scope

- `grimoire context <description>` — hybrid search + relationship traversal to return relevant docs
- Options: `--limit`, `--include-tasks`, `--include-decisions`, `--depth`, `--compact`, `--type`
- Combines semantic search results with relationship graph traversal
- Returns: relevant requirements, parent features, related decisions, open tasks, dependencies — all in one structured JSON response
- Depends on: Search and Relationships features

## Acceptance criteria

- Returns relevant documents for a natural language description
- Includes related documents found via graph traversal, not just direct search hits
- Response is structured JSON suitable for AI agent consumption
- Respects limit and filter options
- Performs within 2s for typical project sizes (<200 documents)

## Non-goals

- No caching of context results between calls
- No learning/ranking based on past queries
