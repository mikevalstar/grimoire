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

Hybrid search combining BM25 full-text search and HNSW vector similarity search across all project documents.

## Scope

- \`grimoire search <query>\` — hybrid search with configurable weighting
- Full-text search via DuckDB FTS extension (BM25 ranking)
- Semantic search via DuckDB VSS extension (HNSW approximate nearest neighbor)
- Filters: \`--type\`, \`--status\`, \`--tag\`, \`--limit\`, \`--threshold\`
- Mode overrides: \`--semantic-only\`, \`--keyword-only\`
- Configurable semantic/keyword weight ratio in config.yaml
- Local embeddings via \`@huggingface/transformers\` with nomic-embed-text-v1.5 (ONNX)
- Cached content-hash → vector map at \`.grimoire/.cache/embeddings.json\`

## Current Status

Not yet implemented. DuckDB FTS and VSS extensions need to be loaded and configured. Embedding pipeline needs to be built.

---

## Comments

---

## Changelog

### 2026-03-29 19:00 | grimoire

Document created.
