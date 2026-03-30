---
id: "req-00nta-vss-index-via-duckdb"
uid: "00nta"
title: "VSS Index via DuckDB"
type: "requirement"
status: "draft"
priority: "critical"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-4
  - search
  - duckdb
  - vector
feature: "feat-wqzng-local-embeddings-semantic-search"
tasks: []
depends_on: []
---

# VSS Index via DuckDB

## Description

Create a vector similarity search (VSS) index on the documents table embedding column using the DuckDB vss extension with HNSW and cosine similarity.

## Acceptance Criteria

- Install and load DuckDB vss extension during database setup
- Create HNSW index on documents.embedding column with cosine metric
- Vector similarity queries return results ranked by cosine similarity
- Index rebuilds correctly during grimoire sync --force
- Graceful fallback if vss extension is unavailable (keyword-only search)

## Implementation Notes

- DDL: CREATE INDEX embedding_idx ON documents USING HNSW (embedding) WITH (metric = 'cosine')
- vss extension may need explicit installation: INSTALL vss; LOAD vss;
- Check DuckDB version compatibility with vss extension

---

## Comments

---

## Changelog

### 2026-03-30 19:16 | grimoire

Document created.
