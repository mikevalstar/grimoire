---
id: "req-cm7cx-local-embedding-generation"
uid: "cm7cx"
title: "Local Embedding Generation"
type: "requirement"
status: "draft"
priority: "critical"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-4
  - embeddings
  - onnx
feature: "feat-wqzng-local-embeddings-semantic-search"
tasks: []
depends_on: []
---

# Local Embedding Generation

## Description

Generate vector embeddings locally using @huggingface/transformers with the nomic-embed-text-v1.5 model running via ONNX runtime. No external API calls required.

## Acceptance Criteria

- Embed document body text into 768-dimensional vectors using nomic-embed-text-v1.5
- Use @huggingface/transformers for local ONNX inference
- Embeddings generated during grimoire sync (full and incremental)
- Store embeddings in the documents table embedding column
- Handle documents of varying lengths (chunking strategy if needed for long docs)
- Embedding generation should be optional — search falls back to keyword-only if embeddings unavailable

## Implementation Notes

- nomic-embed-text-v1.5 produces 768-dim vectors
- Consider batching for performance during full sync
- May need to truncate/chunk documents exceeding model context window

---

## Comments

---

## Changelog

### 2026-03-30 19:16 | grimoire

Document created.
