---
id: "feat-n8gsu-search-full-text-semantic"
uid: "n8gsu"
title: "Search — Full-Text & Semantic"
type: "feature"
status: "proposed"
priority: "high"
created: "2026-03-29"
updated: "2026-03-29"
tags:
  - core
  - search
requirements: []
decisions: []
---

# Search — Full-Text & Semantic

**Why:** AI agents need to find relevant documents without knowing exact IDs or titles. Keyword search alone misses semantic matches; vector search alone misses exact terms. Hybrid search gives the best of both.

## Scope

- `grimoire search <query>` — hybrid search with configurable weighting
- Full-text search via DuckDB FTS extension (BM25 ranking)
- Semantic search via DuckDB VSS extension (HNSW approximate nearest neighbor)
- Filters: `--type`, `--status`, `--tag`, `--limit`, `--threshold`
- Mode overrides: `--semantic-only`, `--keyword-only`
- Configurable semantic/keyword weight ratio in config.yaml
- Local embeddings via `@huggingface/transformers` with nomic-embed-text-v1.5 (ONNX)
- Cached content-hash → vector map at `.grimoire/.cache/embeddings.json`

## Acceptance criteria

- FTS returns results ranked by BM25 score
- Semantic search returns results ranked by cosine similarity
- Hybrid mode merges and deduplicates results with combined ranking
- Filters narrow results correctly
- Embeddings are generated locally without external API calls
- <500ms for typical queries on projects with <200 documents

## Non-goals

- No external embedding providers (local only for v1)
- No cross-repository search
- No real-time index updates (requires sync)
