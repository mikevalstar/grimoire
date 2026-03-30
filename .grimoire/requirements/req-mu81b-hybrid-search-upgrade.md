---
id: "req-mu81b-hybrid-search-upgrade"
uid: "mu81b"
title: "Hybrid Search Upgrade"
type: "requirement"
status: "draft"
priority: "critical"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-4
  - search
feature: "feat-wqzng-local-embeddings-semantic-search"
tasks: []
depends_on: []
---

# Hybrid Search Upgrade

## Description

Upgrade grimoire search from keyword-only (BM25) to hybrid search combining BM25 full-text scores with semantic vector similarity scores, with configurable weights.

## Acceptance Criteria

- grimoire search runs both BM25 and vector similarity queries
- Results scored as: weight*keyword * bm25*score + weight_semantic * cosine_score
- Weights configurable via search.keyword_weight and search.semantic_weight in config.yaml (default 0.5/0.5)
- Results deduplicated and ranked by combined score
- Graceful degradation: keyword-only if no embeddings available
- Search performance under 1s for typical project sizes (<500 documents)

## Implementation Notes

- Normalize BM25 and cosine scores to comparable ranges before combining
- Consider reciprocal rank fusion as an alternative to weighted scoring

---

## Comments

---

## Changelog

### 2026-03-30 19:16 | grimoire

Document created.
