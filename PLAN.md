# Grimoire AI — Project Requirements

> **Domain:** grimoireai.quest
> **Repository:** TBD
> **License:** TBD (MIT or Apache-2.0 recommended)

## Overview

Grimoire AI is a local-first, AI-native requirements management tool for software projects. It stores project knowledge — features, requirements, tasks, and architecture decisions — as structured markdown files that live in your git repository. A local DuckDB database acts as a derived cache, providing full-text search, semantic (vector) search, and graph-style relational queries across all project documents.

The primary interface is a CLI designed for consumption by AI coding agents (Claude Code, Cursor, Copilot, etc.). A secondary browser-based UI (launched locally, drizzle-kit style) provides humans with a visual management and exploration layer.

Grimoire answers the question: **"How does an AI agent get oriented in a project — fast?"**

---

## Core Principles

1. **Markdown is the source of truth.** All data lives as `.md` files with YAML frontmatter. The database is always rebuildable from files.
2. **Git-native.** The `.grimoire/` directory lives in your repo. Files are diffable, reviewable in PRs, and mergeable.
3. **AI-first, human-friendly.** The CLI outputs structured JSON for agents. The web UI provides visual management for humans. Both operate on the same data.
4. **Local and free.** No cloud services required. Embeddings run locally via ONNX. No API keys needed for core functionality.
5. **Fast.** CLI commands should complete in under 200ms for non-search operations. Search should feel instant for corpora under 1000 documents.

---

## Tech Stack

| Layer                | Technology                  | Purpose                                             |
| -------------------- | --------------------------- | --------------------------------------------------- |
| **Runtime**          | Node.js                     | Application runtime                                 |
| **CLI Framework**    | `commander`                 | CLI argument parsing and subcommands                |
| **Database**         | DuckDB via `duckdb-async`   | Local query engine (gitignored, derived from files) |
| **Full-Text Search** | DuckDB `fts` extension      | BM25-ranked keyword search                          |
| **Vector Search**    | DuckDB `vss` extension      | HNSW approximate nearest neighbor search            |
| **Embeddings**       | `@huggingface/transformers` | Local ONNX model inference                          |
| **Embedding Model**  | nomic-embed-text-v1.5       | Default model, downloaded + cached on first run     |
| **Web Server**       | Fastify                     | Local HTTP server for web UI                        |
| **Frontend**         | React + Vite                | SPA served as static assets                         |
| **Distribution**     | npm (`npx grimoire-ai`)     | Global install or npx execution                     |

### Optional / Pluggable

| Component             | Options                           | Notes                                                       |
| --------------------- | --------------------------------- | ----------------------------------------------------------- |
| **Embedding backend** | Ollama, OpenAI, Anthropic, Cohere | For users who prefer cloud embeddings or already run Ollama |
| **Export formats**    | JSON, CSV, Markdown summary       | For integration with other tools                            |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Core Library                    │
│  (file I/O, DuckDB ops, embedding, search)      │
├──────────────────────┬──────────────────────────┤
│      CLI Layer       │     HTTP Server Layer     │
│  (commander, JSON    │   (Fastify, REST API,     │
│   output, stdin)     │    static SPA serving)    │
└──────────────────────┴──────────────────────────┘

CLI and Server are thin wrappers around the same core library.
The CLI does NOT require the server to be running.
```

---

## File Structure

All Grimoire data lives in a `.grimoire/` directory at the project root.

```
project-root/
├── .grimoire/
│   ├── overview.md              # Single project overview document
│   ├── features/
│   │   ├── user-auth.md
│   │   ├── payment-processing.md
│   │   └── notification-system.md
│   ├── requirements/
│   │   ├── req-001-oauth-login.md
│   │   ├── req-002-session-mgmt.md
│   │   └── req-003-role-permissions.md
│   ├── tasks/
│   │   ├── task-001-setup-oauth-provider.md
│   │   ├── task-002-jwt-token-flow.md
│   │   └── task-003-write-auth-tests.md
│   ├── decisions/
│   │   ├── adr-001-use-jwt-over-sessions.md
│   │   ├── adr-002-postgres-over-mongo.md
│   │   └── adr-003-tanstack-over-nextjs.md
│   ├── .skills/                 # AI agent skill files (copied on init)
│   │   ├── OVERVIEW.md
│   │   ├── READING.md
│   │   ├── WRITING.md
│   │   ├── SEARCHING.md
│   │   ├── WORKFLOW.md
│   │   └── SCHEMA.md
│   └── .cache/                  # GITIGNORED
│       ├── grimoire.duckdb      # Derived database
│       ├── grimoire.duckdb.wal
│       └── embeddings.json      # Cached content-hash → vector map
├── .gitignore                   # Should include .grimoire/.cache/
└── ... (rest of project)
```

### AI Agent Skills

Grimoire ships with a set of AI agent skill files (inspired by [agentskills.io](https://agentskills.io/home)) that teach AI coding agents how to use Grimoire effectively. These are reference documents the agent reads before interacting with the CLI.

Skill files live in the npm package and are copied into `.grimoire/.skills/` on `grimoire init` so agents with file access can read them directly.

| Skill File     | Purpose                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------- |
| `OVERVIEW.md`  | What Grimoire is, when to use which command, quick start                                     |
| `READING.md`   | How to read and interpret Grimoire documents, frontmatter fields, changelog format           |
| `WRITING.md`   | How to create and update documents properly, required fields, conventions                    |
| `SEARCHING.md` | How to use search and context commands effectively, query tips, filter combos                |
| `WORKFLOW.md`  | Recommended workflows: starting a task, updating progress, recording decisions, closing work |
| `SCHEMA.md`    | Document schemas, frontmatter fields, valid status/priority values, relationship types       |

These skills are designed so that an AI agent can run `cat .grimoire/.skills/OVERVIEW.md` to bootstrap its understanding, then reference specific skill files as needed. The skills should be written to be consumed by AI agents, not humans — concise, example-heavy, and structured for quick parsing.

The `.skills/` directory is committed to git so that it's available to any agent with filesystem access. It is NOT gitignored.

---

## Document Schemas

All documents use YAML frontmatter followed by freeform markdown body content. The body is the primary content that gets embedded for semantic search.

### Changelog & Comments

Every document includes a `## Changelog` section at the bottom, separated by a horizontal rule (`---`). Changelog entries serve two purposes:

1. **Change descriptions** — plain text entries recording what changed and when.
2. **Comments** — blockquoted entries (`>`) for discussion, questions, and commentary.

Both humans and AI agents can append changelog entries. The author field can be a person's name, an agent identifier (e.g., `claude-code`), or omitted. The changelog is part of the markdown body and is included in the embedded content for semantic search — meaning you can search for discussions and decisions captured in comments.

Changelog entry format:

```markdown
### YYYY-MM-DD | author

Description of change.

### YYYY-MM-DD | author

> This is a comment or question, not a change description.
> Blockquoted entries are discussion/commentary.
```

### Overview (`overview.md`)

```yaml
---
id: overview
title: "Project Name"
description: "One-line project description"
type: overview
created: 2026-03-29
updated: 2026-03-29
tags: []
---

# Project Name

Freeform markdown describing the project at a high level.
Goals, scope, target users, key constraints, tech stack summary, etc.

This is the document an AI agent reads first to understand "what is this project."

---

## Changelog

### 2026-03-29 | mike
Initial project overview created. Defined scope and target users.

### 2026-03-29 | mike
> Decided to prioritize the API layer first since most users will be mobile.
```

### Feature (`features/*.md`)

```yaml
---
id: feat-user-auth
title: "User Authentication"
type: feature
status: in-progress # proposed | in-progress | complete | deprecated
priority: high # critical | high | medium | low
created: 2026-03-29
updated: 2026-03-29
tags: [security, users]
requirements: # links to requirement IDs
  - req-001-oauth-login
  - req-002-session-mgmt
  - req-003-role-permissions
decisions: # links to decision IDs
  - adr-001-use-jwt-over-sessions
---
# User Authentication

Freeform markdown describing the feature.
User stories, scope, acceptance criteria at the feature level, mockups, etc.
---
## Changelog

### 2026-03-29 | mike
Feature defined. Initial scope includes Google and GitHub OAuth providers.
```

### Requirement (`requirements/*.md`)

```yaml
---
id: req-001-oauth-login
title: "OAuth 2.0 Login Flow"
type: requirement
status: draft              # draft | approved | in-progress | done | rejected
priority: high
feature: feat-user-auth    # parent feature ID
created: 2026-03-29
updated: 2026-03-29
tags: [oauth, login, security]
tasks:                     # links to task IDs
  - task-001-setup-oauth-provider
  - task-002-jwt-token-flow
depends_on: []             # other requirement IDs this depends on
---

# OAuth 2.0 Login Flow

Detailed requirement specification. Acceptance criteria, edge cases,
technical constraints, API contracts, data models, etc.

---

## Changelog

### 2026-03-29 | mike
Draft requirement created from feature discussion.

### 2026-03-30 | mike
> Should we support SAML as well, or is OAuth sufficient for v1?
```

### Task (`tasks/*.md`)

```yaml
---
id: task-001-setup-oauth-provider
title: "Configure OAuth Provider (Google)"
type: task
status: todo               # todo | in-progress | done | blocked | cancelled
priority: high
requirement: req-001-oauth-login   # parent requirement ID
feature: feat-user-auth            # grandparent feature (denormalized for convenience)
assignee: ""                       # optional
created: 2026-03-29
updated: 2026-03-29
tags: [oauth, google, config]
depends_on: []             # other task IDs this is blocked by
---

# Configure OAuth Provider (Google)

Implementation details, steps, notes, code references, etc.
This is what an AI agent reads to understand "what specifically do I need to do."

---

## Changelog

### 2026-03-29 | mike
Task created. Google OAuth chosen as first provider.

### 2026-03-30 | claude-code
Started implementation. Created `src/auth/google.ts` and added env vars to `.env.example`.
```

### Decision (`decisions/*.md`)

```yaml
---
id: adr-001-use-jwt-over-sessions
title: "Use JWT Over Server-Side Sessions"
type: decision
status: accepted           # proposed | accepted | rejected | superseded | deprecated
date: 2026-03-29
created: 2026-03-29
updated: 2026-03-29
tags: [auth, architecture, security]
features:                  # features this decision affects
  - feat-user-auth
supersedes: ""             # ID of decision this replaces
superseded_by: ""          # ID of decision that replaced this
---

# Use JWT Over Server-Side Sessions

## Context

Why was this decision needed? What problem were we solving?

## Decision

What did we decide?

## Consequences

What are the tradeoffs? What does this enable or constrain?

## Alternatives Considered

What else did we evaluate and why did we reject it?

---

## Changelog

### 2026-03-29 | mike
ADR proposed after session management discussion.

### 2026-03-29 | mike
> Revisited after reading the Clerk docs — their approach to short-lived JWTs + refresh is worth noting.

### 2026-03-30 | mike
Status changed to accepted. Team aligned on JWT approach.
```

---

## Database Schema (DuckDB — Derived)

The DuckDB database is rebuilt from markdown files on `grimoire init` or `grimoire sync`. Tables mirror the frontmatter structure with the body content stored for FTS indexing.

```sql
CREATE TABLE documents (
    id VARCHAR PRIMARY KEY,
    title VARCHAR NOT NULL,
    type VARCHAR NOT NULL,          -- 'overview' | 'feature' | 'requirement' | 'task' | 'decision'
    status VARCHAR,
    priority VARCHAR,
    created TIMESTAMP,
    updated TIMESTAMP,
    tags VARCHAR[],
    filepath VARCHAR NOT NULL,      -- relative path from .grimoire/
    body TEXT NOT NULL,              -- markdown body (for FTS)
    embedding FLOAT[768],           -- nomic-embed-text-v1.5 vector
    frontmatter JSON                -- full frontmatter as JSON (for arbitrary queries)
);

CREATE TABLE relationships (
    source_id VARCHAR NOT NULL,
    target_id VARCHAR NOT NULL,
    relationship VARCHAR NOT NULL,  -- 'has_requirement' | 'has_task' | 'has_decision' |
                                    -- 'depends_on' | 'supersedes' | 'parent_feature'
    PRIMARY KEY (source_id, target_id, relationship),
    FOREIGN KEY (source_id) REFERENCES documents(id),
    FOREIGN KEY (target_id) REFERENCES documents(id)
);

CREATE TABLE changelog_entries (
    id INTEGER PRIMARY KEY,
    document_id VARCHAR NOT NULL,   -- parent document ID
    date DATE NOT NULL,
    author VARCHAR,
    content TEXT NOT NULL,
    is_comment BOOLEAN DEFAULT FALSE,  -- true for blockquoted commentary
    FOREIGN KEY (document_id) REFERENCES documents(id)
);
```

FTS index:

```sql
PRAGMA create_fts_index('documents', 'id', 'title', 'body', 'tags');
```

VSS index:

```sql
CREATE INDEX embedding_idx ON documents USING HNSW (embedding) WITH (metric = 'cosine');
```

---

## CLI Commands

The CLI has two modes of operation:

1. **AI mode (default)** — Non-interactive, structured JSON output, designed for programmatic consumption by AI agents. All arguments must be provided as flags. Never prompts for input. Exits with meaningful status codes.
2. **Human mode (`--interactive` or `-i`)** — Interactive prompts, formatted human-readable output, confirmations, color-coded terminal output.

The `<type>` argument in document commands is one of: `feature`, `requirement`, `task`, `decision`.

### Shared / Setup Commands

```
grimoire init                          Initialize .grimoire/ in current directory
    AI mode:  requires --name, errors if missing
    Human mode: prompts for name and description
    --name <n>                         Project name
    --description <desc>               Project description
    --skip-skills                      Don't copy skill files

grimoire sync                          Rebuild DuckDB from markdown files
    --force                            Force full rebuild (re-embed everything)
    --dry-run                          Show what would change without applying

grimoire status                        Project overview: doc counts, open tasks,
                                       recent changes, health summary
    AI mode:  JSON summary with counts, lists, staleness indicators
    Human mode: formatted dashboard with color-coded status

grimoire version                       Show version info
grimoire help [command]                Show help
```

### AI-Focused Commands

These commands are optimized for agent consumption. They output structured JSON, accept all input via flags/stdin, and never prompt.

#### Context (The Killer Feature)

The command AI agents call to get oriented. Returns a curated bundle of relevant documents based on a natural language description of what the agent is about to work on.

```
grimoire context <description>         Get relevant context for a task
    --limit <n>                        Max documents to return (default: 10)
    --include-tasks                    Include open tasks in results
    --include-decisions                Include relevant decisions
    --depth <n>                        Relationship traversal depth (default: 2)
    --compact                          Return summaries instead of full bodies
    --type <type>                      Filter by document type
```

Example: `grimoire context "I need to implement the password reset flow"`

Returns: relevant requirements, the parent feature doc, related architecture decisions, open tasks, and any dependencies — all in one structured JSON response.

#### Search

```
grimoire search <query>                Hybrid search (FTS + semantic)
    --type <type>                      Filter by document type
    --status <status>                  Filter by status
    --tag <tag>                        Filter by tag
    --limit <n>                        Max results (default: 10)
    --semantic-only                    Only vector similarity search
    --keyword-only                     Only BM25 full-text search
    --threshold <0.0-1.0>             Minimum similarity score
```

#### Document Read Operations

```
grimoire <type> list                   List all documents of this type
    --status <status>                  Filter by status
    --priority <priority>              Filter by priority
    --tag <tag>                        Filter by tag (repeatable)
    --feature <feature-id>             Filter by parent feature
    --limit <n>                        Limit results
    --sort <field>                     Sort by field (default: updated)

grimoire <type> get <id>               Get full document content + metadata
    --metadata-only                    Return only frontmatter, no body
    --no-changelog                     Exclude changelog section from output

grimoire overview                      Show the project overview
    --compact                          Summary only (no full body)
```

#### Document Write Operations (Non-Interactive)

All write commands accept full input via flags and stdin. No prompts, no editor launch. Designed for AI agents to create and modify documents programmatically.

```
grimoire <type> create                 Create a new document
    --title <title>                    Document title (REQUIRED)
    --id <id>                          Custom ID (auto-generated from title if omitted)
    --status <status>                  Initial status
    --priority <priority>              Priority level
    --tag <tag>                        Tags (repeatable)
    --feature <feature-id>             Parent feature (for requirements/tasks)
    --requirement <req-id>             Parent requirement (for tasks)
    --body <text>                      Body content (or reads from stdin)
    --from-file <path>                 Import body from an existing file

grimoire <type> update <id>            Update a document
    --title <title>                    Update title
    --status <status>                  Update status
    --priority <priority>              Update priority
    --add-tag <tag>                    Add a tag
    --remove-tag <tag>                 Remove a tag
    --body <text>                      Replace body (or reads from stdin)
    --append <text>                    Append to body

grimoire <type> delete <id>            Delete a document (moves to .grimoire/.archive/)
    --hard                             Permanently delete (no archive)
    --confirm                          Skip confirmation (required in AI mode)
```

#### Changelog & Comments

AI agents use these to record progress, ask questions, and leave notes on documents.

```
grimoire log <id> <message>            Append a changelog entry to a document
    --author <name>                    Author name (default: inferred from git or "agent")
    --comment                          Mark as comment (blockquote) rather than change

grimoire comment <id> <message>        Shorthand for `grimoire log --comment`
    --author <name>                    Author name
```

Example: `grimoire log task-001 "Implemented OAuth flow. Added google.ts and updated env vars." --author claude-code`

Example: `grimoire comment req-001 "Should we support SAML as well?" --author claude-code`

#### Relationships & Graph

```
grimoire links <id>                    Show all relationships for a document
    --direction <in|out|both>          Filter link direction
    --type <relationship-type>         Filter by relationship type
    --depth <n>                        Traversal depth (default: 1)

grimoire tree                          Show the feature → requirement → task tree
    --feature <feature-id>             Show tree for a specific feature
    --status <status>                  Filter by status
    --collapsed                        Show IDs and titles only

grimoire orphans                       Find documents with no relationships
```

#### Validation & Export

```
grimoire validate                      Check for broken links, missing required
                                       fields, orphaned documents, schema issues

grimoire export                        Export project data
    --format <json|csv|md>             Output format
    --type <type>                      Filter by document type
    --output <path>                    Output file path
```

### Human-Focused Commands

These commands are interactive and designed for humans managing the project. They launch editors, show prompts, and provide rich terminal formatting.

```
grimoire <type> new                    Create a document interactively
                                       Prompts for title, status, priority, tags.
                                       Opens $EDITOR for body content.
                                       Shows preview and confirms before saving.

grimoire <type> edit <id>              Open a document in $EDITOR
                                       Full file (frontmatter + body) opened for editing.
                                       Re-syncs to DuckDB on save.

grimoire overview edit                 Open overview in $EDITOR

grimoire ui                            Launch web UI in browser
    --port <port>                      Custom port (default: 4444)
    --no-open                          Don't auto-open browser

grimoire import <path>                 Import documents from a file or directory
    --format <json|md>                 Input format
    --merge                            Merge with existing (default: skip duplicates)
    Human mode: shows diff preview, asks for confirmation

grimoire config                        View/edit grimoire configuration
    --set <key> <value>                Set a config value
    --get <key>                        Get a config value
    --list                             List all config values
    Human mode: interactive config editor with current values shown
```

---

## Configuration (`.grimoire/config.yaml`)

```yaml
project:
  name: "My Project"
  description: "Project description"

embedding:
  provider: local # local | ollama | openai | anthropic
  model: nomic-embed-text-v1.5 # model name
  # ollama_url: http://localhost:11434  # if provider is ollama
  # api_key: ""                        # if provider is cloud

search:
  default_limit: 10
  semantic_weight: 0.5 # weight for hybrid search (0 = keyword only, 1 = semantic only)
  keyword_weight: 0.5

ui:
  port: 4444
  auto_open: true

sync:
  auto_sync: true # re-sync on CLI commands if files changed
  watch: false # file watcher for live sync (when UI is running)

ids:
  auto_generate: true # generate IDs from title slugs
  prefix_by_type: true # e.g., feat-, req-, task-, adr-
```

---

## Future Considerations (Out of Scope for v1)

- **MCP Server mode** — `grimoire serve --mcp` to expose as an MCP server for direct integration with Claude Desktop, Cursor, etc.
- **Multi-project support** — aggregate search across multiple grimoire-enabled repos.
- **Templates** — customizable document templates for different project types.
- **AI-assisted document generation** — `grimoire generate requirement --from "user story text"` using a pluggable LLM.
- **Changelog generation** — diff grimoire state between git commits to auto-generate changelogs.
- **GitHub/Linear/Jira sync** — bidirectional sync with external issue trackers.
- **Collaborative editing** — CR-SQLite or similar for multi-user real-time sync.
- **Diagram generation** — auto-generate Mermaid diagrams from the relationship graph.
