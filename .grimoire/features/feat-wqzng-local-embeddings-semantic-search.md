---
id: "feat-wqzng-local-embeddings-semantic-search"
uid: "wqzng"
title: "Local Embeddings & Semantic Search"
type: "feature"
status: "proposed"
priority: "critical"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-4
  - search
  - embeddings
  - ai
requirements:
  - req-cm7cx-local-embedding-generation
  - req-vix42-embedding-cache
  - req-dmecf-first-run-model-download
  - req-00nta-vss-index-via-duckdb
  - req-mu81b-hybrid-search-upgrade
  - req-kq9if-search-cli-flags-for-semantic-search
  - req-vktkq-pluggable-embedding-backends
decisions: []
---

# Local Embeddings & Semantic Search

**Why:** Keyword search misses conceptually related documents. Semantic search using local embeddings lets grimoire find documents by meaning, not just words — enabling the killer context command and making search genuinely useful for AI agents navigating unfamiliar projects.

## Scope

- Local embedding generation via @huggingface/transformers + nomic-embed-text-v1.5 (ONNX)
- Embedding cache (content-hash → vector) stored in .grimoire/.cache/embeddings.json
- First-run model download with progress indication
- VSS index via DuckDB vss extension (HNSW, cosine similarity)
- Upgrade grimoire search to hybrid mode (BM25 + semantic, configurable weights)
- New search flags: --semantic-only, --keyword-only, --threshold
- Pluggable embedding backends: Ollama, OpenAI (via config)

## Acceptance criteria

- grimoire search returns semantically relevant results even when query terms don't appear in documents
- Hybrid search combines BM25 and vector scores with configurable weights
- Embeddings are cached and only regenerated when content changes
- Model downloads automatically on first use with progress bar
- Alternative embedding providers configurable via config.yaml

## Non-goals

- No cloud-hosted embedding service (local-first, optional cloud backends)
- No fine-tuning or custom model training

---

## Comments

---

## Changelog

### 2026-03-30 19:16 | grimoire

Document created.
