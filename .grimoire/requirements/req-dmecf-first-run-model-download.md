---
id: "req-dmecf-first-run-model-download"
uid: "dmecf"
title: "First-Run Model Download"
type: "requirement"
status: "draft"
priority: "high"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-4
  - embeddings
  - ux
feature: "feat-wqzng-local-embeddings-semantic-search"
tasks: []
depends_on: []
---

# First-Run Model Download

## Description

Automatically download the nomic-embed-text-v1.5 ONNX model on first use, with progress indication so users know what's happening.

## Acceptance Criteria

- Model downloaded automatically when first embedding operation is triggered
- Progress bar or percentage shown during download
- Model cached locally after download (HuggingFace cache directory)
- Graceful handling of network errors with retry and clear error messages
- Subsequent runs use cached model with no download
- AI mode: progress info goes to stderr, not stdout (don't pollute JSON output)

## Implementation Notes

- @huggingface/transformers handles model download and caching
- Model is ~270MB, so progress indication is important
- Consider a grimoire setup or grimoire download-model command for explicit pre-download

---

## Comments

---

## Changelog

### 2026-03-30 19:16 | grimoire

Document created.
