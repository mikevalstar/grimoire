---
id: "req-vktkq-pluggable-embedding-backends"
uid: "vktkq"
title: "Pluggable Embedding Backends"
type: "requirement"
status: "draft"
priority: "medium"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-4
  - embeddings
  - config
feature: "feat-wqzng-local-embeddings-semantic-search"
tasks: []
depends_on: []
---

# Pluggable Embedding Backends

## Description

Allow users to configure alternative embedding providers (Ollama, OpenAI) instead of the default local HuggingFace model, via config.yaml.

## Acceptance Criteria

- embedding.provider config option: local (default), ollama, openai
- Local provider: uses @huggingface/transformers + nomic-embed-text-v1.5 (default)
- Ollama provider: calls local Ollama API (embedding.ollama_url config)
- OpenAI provider: calls OpenAI embeddings API (embedding.api_key config)
- Provider interface is abstracted so new backends can be added easily
- Embedding dimension may vary by provider — handle gracefully in VSS index
- Error if configured provider is unavailable with clear setup instructions

## Implementation Notes

- Define an EmbeddingProvider interface with embed(text: string): Promise<number[]>
- Local provider is the default and requires no configuration
- Ollama and OpenAI providers are optional — don't import their SDKs unless selected

---

## Comments

---

## Changelog

### 2026-03-30 19:17 | grimoire

Document created.
