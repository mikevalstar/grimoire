---
id: "overview"
title: "Grimoire AI"
description: "Local-first, AI-native requirements management CLI tool that stores project knowledge as structured markdown files with YAML frontmatter"
type: "overview"
version: 1
created: "Sat Mar 28 2026 20:00:00 GMT-0400 (Eastern Daylight Time)"
updated: "2026-03-29"
tags:
  - requirements-management
  - cli
  - ai
---

# Grimoire AI

Grimoire AI is a local-first, AI-native requirements management tool for software projects. It answers the question: **"How does an AI agent get oriented in a project — fast?"**

## What It Does

Grimoire stores project knowledge — features, requirements, tasks, and architecture decisions — as structured markdown files that live in your git repository. A local DuckDB database acts as a derived cache, providing full-text search, semantic (vector) search, and graph-style relational queries across all project documents.

## Interfaces

- **CLI (primary)** — designed for consumption by AI coding agents (Claude Code, Cursor, Copilot, etc.). Outputs structured JSON by default, accepts all input via flags/stdin.
- **Web UI (secondary)** — a browser-based local UI (Fastify + React/Vite) for humans to visually manage and explore project knowledge.

## Core Principles

1. **Markdown is the source of truth.** All data lives as `.md` files with YAML frontmatter. The database is always rebuildable from files.
2. **Git-native.** The `.grimoire/` directory lives in your repo. Files are diffable, reviewable in PRs, and mergeable.
3. **AI-first, human-friendly.** The CLI outputs structured JSON for agents. The web UI provides visual management for humans.
4. **Local and free.** No cloud services required. Embeddings run locally via ONNX. No API keys needed for core functionality.
5. **Fast.** CLI commands should complete in under 200ms for non-search operations.

## Tech Stack

- **Runtime:** Node.js (monorepo with pnpm + Vite+)
- **CLI:** commander
- **Database:** DuckDB via `duckdb-async`
- **Search:** DuckDB FTS (BM25) + VSS (HNSW vector search)
- **Embeddings:** `@huggingface/transformers` with nomic-embed-text-v1.5
- **Web Server:** Fastify
- **Frontend:** React + Vite
- **Distribution:** npm (`npx grimoire-ai`)
- **Agent Skills:** agentskills.io convention

## Architecture

Three-layer architecture: Core Library (file I/O, DuckDB ops, embedding, search) → CLI Layer (commander, JSON output) and HTTP Server Layer (Fastify, REST API, static SPA). CLI and Server are thin wrappers around the same core library.

---

## Comments

### 2026-03-29 14:00 | claude-code

> Starting to dogfood grimoire on itself. Breaking down PLAN.md into features to track progress toward v1.

---

## Changelog

### 2026-03-29 14:00 | claude-code

Expanded overview with full project description, principles, tech stack, and architecture summary from PLAN.md.

### 2026-03-29 | grimoire

Initial project overview created via grimoire init.
