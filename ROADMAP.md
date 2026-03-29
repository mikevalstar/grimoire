# Grimoire AI — Roadmap

> Phased delivery plan. Each phase produces a dogfoodable tool. Until publishing lands in Phase 1.5, test via internal workspace commands rather than `npx grimoire-ai`.

---

## Phase 0: Project Scaffolding

Bootstrap the repo and toolchain. No runtime functionality yet.

- [x] Initialize Node.js project with pnpm
- [x] Set up TypeScript, Vite+ toolchain (`vp check`, `vp test`)
- [x] Configure commander entry point (`bin/grimoire`)
- [x] Set up project structure (src/core, src/cli, src/server)
- [x] Add basic CI (lint, typecheck, test)

**Dogfood gate:** The CLI can be built and run locally via internal workspace commands.

---

## Phase 1: Init, File I/O & Basic CRUD

The minimum to start using Grimoire on itself.

- [x] `grimoire init` — create `.grimoire/` directory, `overview.md`, `config.yaml`
- [x] Copy `.skills/` files on init
- [x] Check/update `.gitignore` for `.grimoire/.cache/`
- [x] Inject grimoire section into `CLAUDE.md`/`AGENTS.md` (with `<!--GRIMOIRE START-->` / `<!--GRIMOIRE END-->` tags)
- [ ] Markdown parser: read/write YAML frontmatter + body + changelog sections
- [ ] `grimoire overview` — read and display the overview document
- [ ] `grimoire <type> create` — create feature, requirement, task, decision files
- [ ] `grimoire <type> get <id>` — read a document by ID (scans filesystem)
- [ ] `grimoire <type> list` — list documents of a type (scans filesystem)
- [ ] `grimoire <type> update <id>` — update frontmatter fields and body
- [ ] `grimoire <type> delete <id>` — archive a document
- [ ] `grimoire log` / `grimoire comment` — append changelog entries
- [ ] `grimoire validate` — check frontmatter schemas, required fields
- [ ] JSON output for all commands (AI mode default)
- [ ] `--interactive` flag scaffolding (human-readable output)
- [ ] Write skill files: OVERVIEW, READING, WRITING, SCHEMA

**Dogfood gate:** Use `grimoire init` on this repo via internal workspace commands. Track Grimoire's own features, requirements, and tasks as `.grimoire/` markdown files. AI agents can create and read documents.

---

## Phase 1.5: Publishing Bootstrap

Make the package runnable outside the repo while keeping the testing path inside the workspace until this phase is complete.

- [ ] Publish placeholder to npm (`npx grimoire-ai` prints version)
- [ ] Define and document the pre-publish local test flow using internal workspace commands
- [ ] Smoke test the packaged CLI before wider release

**Dogfood gate:** `npx grimoire-ai --version` works, but day-to-day development can still rely on internal workspace commands.

---

## Phase 2: DuckDB Sync & Search

Add the database layer. Search makes the tool genuinely useful for orientation.

- [ ] DuckDB setup via `duckdb-async` — create tables (documents, relationships, changelog_entries)
- [ ] `grimoire sync` — full rebuild: parse all markdown files into DuckDB
- [ ] Incremental sync: content-hash based, only re-process changed files
- [ ] `--force` and `--dry-run` flags for sync
- [ ] Auto-sync on CLI commands when files have changed
- [ ] Relationship extraction: parse frontmatter links into `relationships` table
- [ ] FTS index via DuckDB `fts` extension
- [ ] `grimoire search <query>` — keyword search (BM25)
- [ ] `grimoire <type> list` — upgrade to use DuckDB with filters (status, priority, tag, feature)
- [ ] `grimoire links <id>` — show relationships for a document
- [ ] `grimoire tree` — feature/requirement/task hierarchy
- [ ] `grimoire orphans` — find unlinked documents
- [ ] `grimoire status` — project dashboard (counts, recent changes)
- [ ] Write skill files: SEARCHING, WORKFLOW

**Dogfood gate:** `grimoire search "authentication"` returns relevant docs. `grimoire tree` shows the full hierarchy. `grimoire status` gives a project snapshot. Agents can orient themselves with search.

---

## Phase 3: Semantic Search & Context

The killer feature. Agents can now get oriented in one command.

- [ ] Local embedding via `@huggingface/transformers` + nomic-embed-text-v1.5
- [ ] Embedding cache (`embeddings.json`): content-hash to vector mapping
- [ ] First-run model download with progress indication
- [ ] VSS index via DuckDB `vss` extension (HNSW, cosine)
- [ ] `grimoire search` — upgrade to hybrid search (BM25 + semantic, configurable weights)
- [ ] `--semantic-only` / `--keyword-only` / `--threshold` flags
- [ ] `grimoire context <description>` — the killer feature:
  - Hybrid search for relevant documents
  - Traverse relationships to pull in connected docs (configurable `--depth`)
  - Return structured JSON bundle: features, requirements, tasks, decisions
  - `--compact` mode for summaries
  - `--include-tasks`, `--include-decisions`, `--type` filters
- [ ] Pluggable embedding backends: Ollama, OpenAI (via config)

**Dogfood gate:** `grimoire context "I need to build the web UI"` returns the feature doc, related requirements, open tasks, and relevant ADRs — all in one call. This is the command agents use to bootstrap context.

---

## Phase 4: Web UI

Visual management layer for humans. Not required for core functionality.

- [ ] Fastify server with static asset serving
- [ ] `grimoire ui` — launch server, auto-open browser
- [ ] React + Vite SPA scaffold
- [ ] Document list views (filterable, sortable)
- [ ] Document detail view (rendered markdown, frontmatter sidebar)
- [ ] Create / edit documents in browser
- [ ] Relationship graph visualization
- [ ] Search interface (keyword + semantic)
- [ ] Project dashboard (status overview, charts)
- [ ] File watcher for live sync when UI is running

**Dogfood gate:** Open the browser to visually review and manage Grimoire's own project docs. Edit a task status from the UI and see it reflected in the markdown file.

---

## Phase 5: Polish & Distribution

Production-ready release.

- [ ] Interactive mode (`-i`) for all commands: prompts, $EDITOR integration, color output
- [ ] `grimoire <type> new` — interactive document creation
- [ ] `grimoire <type> edit <id>` — open in $EDITOR
- [ ] `grimoire import` — bulk import from JSON/markdown
- [ ] `grimoire export` — JSON, CSV, markdown summary
- [ ] `grimoire config` — view/edit configuration
- [ ] Error messages and edge case handling hardened
- [ ] Performance optimization (<200ms target for non-search ops)
- [ ] npm publish pipeline
- [ ] README, documentation site at grimoireai.quest
- [ ] Announce v1.0

**Dogfood gate:** Full workflow is smooth for both humans and AI agents. Published usage and internal workspace testing both work cleanly.

---

## Future (Post-v1)

Tracked in PLAN.md under "Future Considerations":

- MCP Server mode (`grimoire serve --mcp`)
- Multi-project search
- Document templates
- AI-assisted document generation
- Changelog generation from git diffs
- GitHub/Linear/Jira sync
- Collaborative editing (CR-SQLite)
- Mermaid diagram generation from relationship graph
