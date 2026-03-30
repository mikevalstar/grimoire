---
id: "req-vix42-embedding-cache"
uid: "vix42"
title: "Embedding Cache"
type: "requirement"
status: "draft"
priority: "high"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-4
  - embeddings
  - cache
feature: "feat-wqzng-local-embeddings-semantic-search"
tasks: []
depends_on: []
---

# Embedding Cache

## Description

Cache computed embeddings in .grimoire/.cache/embeddings.json as a content-hash → vector mapping so embeddings are only regenerated when document content changes.

## Acceptance Criteria

- Cache stored at .grimoire/.cache/embeddings.json (gitignored)
- Cache keyed by content hash of document body
- On sync, skip embedding generation for documents whose content hash matches cache
- Cache invalidated when document content changes
- grimoire sync --force regenerates all embeddings (ignores cache)
- Cache format is JSON: { "content-hash": [vector], ... }

## Implementation Notes

- Use same content-hash approach as incremental sync
- Cache should survive DuckDB rebuilds (it's a separate file)

---

## Comments

---

## Changelog

### 2026-03-30 19:16 | grimoire

Document created.
