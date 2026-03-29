# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

- VP with PNPM
- Conventional Commits
- PLAN.md should always be updated when requirements change
- Documentation generally is a first class thing; always update docs after doing work

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

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, but it invokes Vite through `vp dev` and `vp build`.

## Vite+ Workflow

`vp` is a global binary that handles the full development lifecycle. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

### Start

- create - Create a new project from a template
- migrate - Migrate an existing project to Vite+
- config - Configure hooks and agent integration
- staged - Run linters on staged files
- install (`i`) - Install dependencies
- env - Manage Node.js versions

### Develop

- dev - Run the development server
- check - Run format, lint, and TypeScript type checks
- lint - Lint code
- fmt - Format code
- test - Run tests

### Execute

- run - Run monorepo tasks
- exec - Execute a command from local `node_modules/.bin`
- dlx - Execute a package binary without installing it as a dependency
- cache - Manage the task cache

### Build

- build - Build for production
- pack - Build libraries
- preview - Preview production build

### Manage Dependencies

Vite+ automatically detects and wraps the underlying package manager such as pnpm, npm, or Yarn through the `packageManager` field in `package.json` or package manager-specific lockfiles.

- add - Add packages to dependencies
- remove (`rm`, `un`, `uninstall`) - Remove packages from dependencies
- update (`up`) - Update packages to latest versions
- dedupe - Deduplicate dependencies
- outdated - Check for outdated packages
- list (`ls`) - List installed packages
- why (`explain`) - Show why a package is installed
- info (`view`, `show`) - View package information from the registry
- link (`ln`) / unlink - Manage local package links
- pm - Forward a command to the package manager

### Maintain

- upgrade - Update `vp` itself to the latest version

These commands map to their corresponding tools. For example, `vp dev --port 3000` runs Vite's dev server and works the same as Vite. `vp test` runs JavaScript tests through the bundled Vitest. The version of all tools can be checked using `vp --version`. This is useful when researching documentation, features, and bugs.

## Common Pitfalls

- **Using the package manager directly:** Do not use pnpm, npm, or Yarn directly. Vite+ can handle all package manager operations.
- **Always use Vite commands to run tools:** Don't attempt to run `vp vitest` or `vp oxlint`. They do not exist. Use `vp test` and `vp lint` instead.
- **Running scripts:** Vite+ built-in commands (`vp dev`, `vp build`, `vp test`, etc.) always run the Vite+ built-in tool, not any `package.json` script of the same name. To run a custom script that shares a name with a built-in command, use `vp run <script>`. For example, if you have a custom `dev` script that runs multiple services concurrently, run it with `vp run dev`, not `vp dev` (which always starts Vite's dev server).
- **Do not install Vitest, Oxlint, Oxfmt, or tsdown directly:** Vite+ wraps these tools. They must not be installed directly. You cannot upgrade these tools by installing their latest versions. Always use Vite+ commands.
- **Use Vite+ wrappers for one-off binaries:** Use `vp dlx` instead of package-manager-specific `dlx`/`npx` commands.
- **Import JavaScript modules from `vite-plus`:** Instead of importing from `vite` or `vitest`, all modules should be imported from the project's `vite-plus` dependency. For example, `import { defineConfig } from 'vite-plus';` or `import { expect, test, vi } from 'vite-plus/test';`. You must not install `vitest` to import test utilities.
- **Type-Aware Linting:** There is no need to install `oxlint-tsgolint`, `vp lint --type-aware` works out of the box.

## CI Integration

For GitHub Actions, consider using [`voidzero-dev/setup-vp`](https://github.com/voidzero-dev/setup-vp) to replace separate `actions/setup-node`, package-manager setup, cache, and install steps with a single action.

```yaml
- uses: voidzero-dev/setup-vp@v1
  with:
    cache: true
- run: vp check
- run: vp test
```

## Review Checklist for Agents

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to validate changes.
<!--VITE PLUS END-->
