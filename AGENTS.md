# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

- PNPM
- PLAN.md should always be updated when requirements change

## Project Overview

Grimoire AI is a local-first, AI-native requirements management CLI tool. It stores project knowledge (features, requirements, tasks, architecture decisions) as structured markdown files with YAML frontmatter in a `.grimoire/` directory. A local DuckDB database serves as a derived cache for full-text search, semantic (vector) search, and relational queries.

**Domain:** grimoireai.quest
**Distribution:** npm (`npx grimoire-ai`)

## Architecture

The codebase follows a three-layer architecture:

1. **Core Library** — file I/O, DuckDB operations, embedding generation, search logic
2. **CLI Layer** — `commander`-based CLI with two modes: AI mode (default, JSON output, non-interactive) and Human mode (`--interactive`, prompts/formatted output)
3. **HTTP Server Layer** — Fastify server serving a React+Vite SPA for the web UI

CLI and Server are thin wrappers around the same core library. The CLI does NOT require the server.

## Tech Stack

- **Runtime:** Node.js
- **CLI:** commander
- **Database:** DuckDB via `duckdb-async` (gitignored, derived from markdown files)
- **Search:** DuckDB `fts` extension (BM25) + `vss` extension (HNSW vector search)
- **Embeddings:** `@huggingface/transformers` with nomic-embed-text-v1.5 (local ONNX)
- **Web Server:** Fastify
- **Frontend:** React + Vite

## Key Design Principles

- Markdown files are the source of truth; the database is always rebuildable via `grimoire sync`
- All data lives in `.grimoire/` and is committed to git (except `.grimoire/.cache/` which is gitignored)
- AI mode (default): structured JSON output, all input via flags/stdin, never prompts
- Human mode (`-i`/`--interactive`): interactive prompts, color output, editor integration
- Performance target: <200ms for non-search operations

## Data Model

Four document types plus an overview, all as markdown with YAML frontmatter:
- **overview** (`overview.md`) — single project overview
- **feature** (`features/*.md`) — high-level features, links to requirements and decisions
- **requirement** (`requirements/*.md`) — detailed specs, links to parent feature and tasks
- **task** (`tasks/*.md`) — implementation work items, links to parent requirement/feature
- **decision** (`decisions/*.md`) — ADRs, links to affected features, supports supersedes chain

Documents include a `## Changelog` section with dated entries (plain text for changes, blockquoted for comments/discussion).

Relationships are stored both in frontmatter (as ID references) and in a `relationships` table in DuckDB.

## DuckDB Schema

Three tables: `documents` (id, title, type, status, priority, tags, body, embedding, frontmatter JSON), `relationships` (source_id, target_id, relationship type), `changelog_entries` (document_id, date, author, content, is_comment). See PLAN.md for full DDL.

## CLI Command Structure

- `grimoire init` — initialize `.grimoire/` directory with overview and config
- `grimoire sync` — rebuild DuckDB from markdown files
- `grimoire context <description>` — the killer feature: hybrid search returning relevant docs for a task description
- `grimoire search <query>` — hybrid FTS + semantic search
- `grimoire <type> list|get|create|update|delete` — CRUD operations on documents
- `grimoire log|comment <id> <message>` — append changelog/comment entries
- `grimoire links|tree|orphans` — relationship/graph queries
- `grimoire validate` — check for broken links, missing fields
- `grimoire ui` — launch web UI (default port 4444)

## AI Agent Skills

Grimoire ships skill files copied to `.grimoire/.skills/` on init (OVERVIEW, READING, WRITING, SEARCHING, WORKFLOW, SCHEMA). These are reference docs for AI agents, not for humans.
