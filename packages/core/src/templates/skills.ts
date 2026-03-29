/**
 * AI agent skill file templates.
 * These are copied to .grimoire/.skills/ on init.
 * TODO: flesh out with full content in a later pass.
 */

export const skillFiles: Record<string, string> = {
  "OVERVIEW.md": `# Grimoire AI — Overview Skill

> This file teaches AI agents how to use Grimoire. Read this first.

## What is Grimoire?

Grimoire AI is a local-first requirements management tool. All project knowledge
lives as markdown files in \`.grimoire/\` with YAML frontmatter.

## Document Types

| Type | Directory | Purpose |
|------|-----------|---------|
| overview | \`overview.md\` | Single project overview — read this first |
| feature | \`features/\` | High-level features |
| requirement | \`requirements/\` | Detailed specs linked to features |
| task | \`tasks/\` | Implementation work items linked to requirements |
| decision | \`decisions/\` | Architecture Decision Records (ADRs) |

## Getting Started

1. \`grimoire overview\` — read the project overview
2. \`grimoire context "<what you're working on>"\` — get relevant documents
3. \`grimoire search "<query>"\` — find specific documents
4. \`grimoire <type> list\` — browse documents by type

## Output Format

All commands output structured JSON by default (AI mode).
Use \`--interactive\` or \`-i\` for human-readable output.
`,

  "READING.md": `# Grimoire AI — Reading Skill

> How to read and interpret Grimoire documents.

## Document Structure

Every document has:
1. **YAML frontmatter** — structured metadata (id, title, type, status, etc.)
2. **Markdown body** — freeform content
3. **Changelog section** — dated entries at the bottom, after a \`---\` separator

## Frontmatter Fields

Common fields across all types: \`id\`, \`title\`, \`type\`, \`status\`, \`priority\`,
\`created\`, \`updated\`, \`tags\`.

Type-specific fields:
- **feature**: \`requirements\`, \`decisions\`
- **requirement**: \`feature\`, \`tasks\`, \`depends_on\`
- **task**: \`requirement\`, \`feature\`, \`assignee\`, \`depends_on\`
- **decision**: \`date\`, \`features\`, \`supersedes\`, \`superseded_by\`

## Changelog Format

\`\`\`markdown
### YYYY-MM-DD | author
Description of change.

### YYYY-MM-DD | author
> This is a comment (blockquoted = discussion, not a change).
\`\`\`

## Commands

- \`grimoire <type> get <id>\` — full document with metadata
- \`grimoire <type> get <id> --metadata-only\` — frontmatter only
- \`grimoire overview\` — project overview
- \`grimoire links <id>\` — relationships for a document
`,

  "WRITING.md": `# Grimoire AI — Writing Skill

> How to create and update Grimoire documents.

## Creating Documents

\`\`\`
grimoire <type> create --title "<title>" --body "<content>"
\`\`\`

Optional flags: \`--id\`, \`--status\`, \`--priority\`, \`--tag\`, \`--feature\`, \`--requirement\`

IDs are auto-generated from the title if not provided (e.g., "User Auth" → "feat-user-auth").

## Updating Documents

\`\`\`
grimoire <type> update <id> --status <status>
grimoire <type> update <id> --body "<new content>"
grimoire <type> update <id> --add-tag <tag>
\`\`\`

## Recording Progress

\`\`\`
grimoire log <id> "<message>" --author <name>
grimoire comment <id> "<question or discussion>" --author <name>
\`\`\`

## Status Values

| Type | Statuses |
|------|----------|
| feature | proposed, in-progress, complete, deprecated |
| requirement | draft, approved, in-progress, done, rejected |
| task | todo, in-progress, done, blocked, cancelled |
| decision | proposed, accepted, rejected, superseded, deprecated |

## Priority Values

critical, high, medium, low
`,

  "SEARCHING.md": `# Grimoire AI — Searching Skill

> How to find information in Grimoire.

## Search

\`\`\`
grimoire search "<query>"
\`\`\`

Hybrid search combines keyword (BM25) and semantic (vector) matching.

Flags: \`--type\`, \`--status\`, \`--tag\`, \`--limit\`, \`--semantic-only\`, \`--keyword-only\`

## Context (The Key Command)

\`\`\`
grimoire context "<description of what you're working on>"
\`\`\`

Returns a curated bundle of relevant documents based on natural language.
Use this to orient yourself before starting work.

Flags: \`--limit\`, \`--include-tasks\`, \`--include-decisions\`, \`--depth\`, \`--compact\`

## Listing

\`\`\`
grimoire <type> list --status <status> --priority <priority> --tag <tag>
\`\`\`

## Relationships

\`\`\`
grimoire links <id>          # show relationships
grimoire tree                # feature → requirement → task hierarchy
grimoire orphans             # unlinked documents
\`\`\`
`,

  "WORKFLOW.md": `# Grimoire AI — Workflow Skill

> Recommended workflows for AI agents using Grimoire.

## Starting Work on a Task

1. \`grimoire context "<what you need to do>"\` — get relevant context
2. \`grimoire task get <id>\` — read the specific task
3. \`grimoire task update <id> --status in-progress\` — mark as started
4. Do the work
5. \`grimoire log <id> "<what you did>"\` — record progress
6. \`grimoire task update <id> --status done\` — mark as complete

## Recording a Decision

1. \`grimoire decision create --title "<decision>" --body "<context, decision, consequences>"\`
2. Link to affected features if applicable

## Updating Requirements

1. \`grimoire requirement get <id>\` — read current state
2. \`grimoire requirement update <id> --status <new-status>\`
3. \`grimoire log <id> "<what changed and why>"\`

## Asking Questions

Use comments to record questions or discussion:
\`grimoire comment <id> "<your question>"\`
`,

  "SCHEMA.md": `# Grimoire AI — Schema Skill

> Document schemas and valid field values.

## Document Types

### Overview
- **File:** \`.grimoire/overview.md\`
- **Required fields:** id, title, description, type, created, updated
- **type:** \`overview\`

### Feature
- **Directory:** \`.grimoire/features/\`
- **Required fields:** id, title, type, status, priority, created, updated
- **Status values:** proposed, in-progress, complete, deprecated
- **Links:** requirements[], decisions[]

### Requirement
- **Directory:** \`.grimoire/requirements/\`
- **Required fields:** id, title, type, status, priority, feature, created, updated
- **Status values:** draft, approved, in-progress, done, rejected
- **Links:** feature, tasks[], depends_on[]

### Task
- **Directory:** \`.grimoire/tasks/\`
- **Required fields:** id, title, type, status, priority, requirement, created, updated
- **Status values:** todo, in-progress, done, blocked, cancelled
- **Links:** requirement, feature, depends_on[]

### Decision
- **Directory:** \`.grimoire/decisions/\`
- **Required fields:** id, title, type, status, date, created, updated
- **Status values:** proposed, accepted, rejected, superseded, deprecated
- **Links:** features[], supersedes, superseded_by

## Priority Values (all types)

critical, high, medium, low

## Tag Format

Lowercase, hyphen-separated. Example: \`api-design\`, \`security\`, \`tech-debt\`
`,
};
