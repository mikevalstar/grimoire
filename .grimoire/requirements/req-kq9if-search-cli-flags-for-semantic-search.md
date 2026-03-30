---
id: "req-kq9if-search-cli-flags-for-semantic-search"
uid: "kq9if"
title: "Search CLI Flags for Semantic Search"
type: "requirement"
status: "draft"
priority: "high"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-4
  - search
  - cli
feature: "feat-wqzng-local-embeddings-semantic-search"
tasks: []
depends_on: []
---

# Search CLI Flags for Semantic Search

## Description

Add new CLI flags to grimoire search to control hybrid vs keyword-only vs semantic-only search modes and similarity threshold.

## Acceptance Criteria

- --semantic-only: only vector similarity search (no BM25)
- --keyword-only: only BM25 full-text search (no vector) — preserves Phase 2 behavior
- --threshold <0.0-1.0>: minimum similarity score to include in results
- Flags are mutually exclusive (--semantic-only and --keyword-only cannot be combined)
- Default behavior (no flags) uses hybrid search
- Update skill documentation (SKILL.md) with new flags

## Implementation Notes

- Extend existing search command in CLI layer
- --keyword-only already works implicitly today; make it explicit

---

## Comments

---

## Changelog

### 2026-03-30 19:17 | grimoire

Document created.
