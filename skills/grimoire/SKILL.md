---
name: grimoire
description: >
  How to use Grimoire AI for project requirements management. Grimoire stores features,
  requirements, tasks, and architecture decisions as structured markdown files in a
  `.grimoire/` directory. Use this skill whenever working in a project that has a
  `.grimoire/` directory, when the user mentions grimoire commands, when you need to
  understand project requirements or context, when creating/updating/reading project
  documents like features, requirements, tasks, or decisions, or when you need to orient
  yourself in a project's requirements structure. Also use this skill when the user asks
  you to record a decision, track a task, log progress, or manage project knowledge.
---

# Grimoire AI

Grimoire is a local-first requirements management tool. All project knowledge lives as markdown files with YAML frontmatter in `.grimoire/`. Files are the source of truth — they're diffable, reviewable in PRs, and committed to git.

## When to use Grimoire

- **Starting work**: read the overview and relevant documents to understand what you're working on
- **During work**: log progress, update task status, record decisions
- **Finishing work**: mark tasks done, add changelog entries, update requirement status

## Quick orientation

```bash
grimoire overview                    # read the project overview first
grimoire feature list                # see all features
grimoire task list --status todo     # find open work
grimoire validate                    # check for broken links or missing fields
```

## Output format

All commands output JSON by default. Use `--format cli` for human-readable output, or `--format auto` to let grimoire decide based on context. Every command accepts `--cwd <path>` to target a different directory.

---

## Document types

Grimoire manages five document types in a hierarchy:

```
overview (single file)
  features/          — high-level capabilities
    requirements/    — detailed specs (belong to a feature)
      tasks/         — implementation work (belong to a requirement)
  decisions/         — architecture decision records (linked to features)
```

Each document is a markdown file with YAML frontmatter containing structured metadata (id, title, type, status, priority, tags, relationships) followed by freeform body content, then Comments and Changelog sections at the bottom.

### Status values by type

| Type        | Statuses                                             |
| ----------- | ---------------------------------------------------- |
| feature     | proposed, in-progress, complete, deprecated          |
| requirement | draft, approved, in-progress, done, rejected         |
| task        | todo, in-progress, done, blocked, cancelled          |
| decision    | proposed, accepted, rejected, superseded, deprecated |

**Priority** (all types): critical, high, medium, low

---

## Reading documents

### Project overview

```bash
grimoire overview                 # full overview
grimoire overview --compact       # summary only, no changelog
```

### Get a specific document

Use the document's ID (the `id` field from frontmatter, or just the unique `uid` portion):

```bash
grimoire feature get feat-a3f2k-user-authentication
grimoire task get g9m4t                    # short uid works too
grimoire requirement get d5h8p --metadata-only    # frontmatter only
grimoire decision get k2q5x --no-changelog        # skip changelog section
```

### List documents

```bash
grimoire feature list
grimoire task list --status todo --priority high
grimoire requirement list --feature feat-a3f2k-user-authentication
grimoire decision list --tag security --limit 5 --sort updated
```

**Filters**: `--status`, `--priority`, `--tag`, `--feature`, `--limit`, `--sort`

---

## Creating documents

Every create command requires `--title`. IDs are auto-generated from the title if `--id` is not provided (e.g., "User Authentication" becomes `feat-xxxxx-user-authentication`).

```bash
grimoire feature create --title "User Authentication" \
  --status proposed --priority high \
  --tag security --tag users \
  --body "OAuth-based authentication for all user types."

grimoire requirement create --title "OAuth 2.0 Login Flow" \
  --feature feat-a3f2k-user-authentication \
  --priority high --status draft \
  --body "Support Google and GitHub OAuth providers."

grimoire task create --title "Configure Google OAuth" \
  --requirement req-d5h8p-oauth-20-login-flow \
  --feature feat-a3f2k-user-authentication \
  --priority high --status todo \
  --body "Set up Google OAuth credentials and implement the callback handler."

grimoire decision create --title "Use JWT Over Sessions" \
  --feature feat-a3f2k-user-authentication \
  --status proposed \
  --body "## Context\nStateless auth needed for API consumers.\n\n## Decision\nUse short-lived JWTs.\n\n## Consequences\nNo server-side session store needed."
```

**Tip**: Use `--from-file <path>` to import body content from an existing file instead of `--body`.

Tags are repeatable: `--tag security --tag auth --tag oauth`.

---

## Updating documents

```bash
grimoire task update g9m4t --status in-progress
grimoire feature update a3f2k --priority critical --add-tag urgent
grimoire requirement update d5h8p --remove-tag draft --add-tag approved --status approved
grimoire task update g9m4t --body "Updated implementation plan..."
grimoire task update g9m4t --append "Additional notes after investigation."
```

---

## Deleting documents

Delete moves documents to `.grimoire/.archive/` by default:

```bash
grimoire task delete g9m4t --confirm        # archive (recoverable)
grimoire task delete g9m4t --hard --confirm  # permanent delete
```

The `--confirm` flag is required in non-interactive mode (which is the default).

---

## Logging progress and comments

Record what you did or ask questions on any document. The `log` command auto-detects the document type from the ID.

```bash
# Record a change
grimoire log g9m4t "Implemented OAuth callback. Added google.ts and updated env vars." --author claude-code

# Ask a question or leave a note (goes to Comments section)
grimoire comment d5h8p "Should we support SAML as well, or is OAuth sufficient for v1?" --author claude-code
```

`grimoire comment` is shorthand for `grimoire log --comment`.

---

## Validation

Check the health of your grimoire documents:

```bash
grimoire validate
```

This checks for:

- Missing required frontmatter fields
- Invalid status or priority values
- Broken relationship links (e.g., a task referencing a non-existent requirement)
- ID mismatches (filename vs frontmatter id)
- Orphaned documents with no relationships
- Schema violations

Returns exit code 1 if there are errors, 0 if clean.

---

## Document structure

Every document follows this structure:

```markdown
---
id: feat-a3f2k-user-authentication
uid: a3f2k
title: "User Authentication"
type: feature
status: in-progress
priority: high
created: 2026-03-29
updated: 2026-03-29
tags: [security, users]
requirements:
  - req-d5h8p-oauth-20-login-flow
decisions:
  - adr-k2q5x-use-jwt-over-sessions
---

# User Authentication

Body content here — freeform markdown describing the feature.

---

## Comments

### 2026-03-30 09:15 | mike

> Should we support SAML as well?

---

## Changelog

### 2026-03-29 10:00 | mike

Feature defined. Initial scope includes Google and GitHub OAuth providers.
```

### Type-specific frontmatter fields

- **feature**: `requirements[]`, `decisions[]`
- **requirement**: `feature` (parent), `tasks[]`, `depends_on[]`
- **task**: `requirement` (parent), `feature` (grandparent), `assignee`, `depends_on[]`
- **decision**: `date`, `features[]`, `supersedes`, `superseded_by`

---

## Writing good features and requirements

When creating or updating features and requirements, read `references/writing-guide.md` for the default format — covers structure (why, acceptance criteria, non-goals) and style (terse, bullet-point-first). If the project or user has specified their own writing conventions, defer to those instead.

---

## Recommended workflow for AI agents

### Starting a new piece of work

1. `grimoire overview` — understand the project
2. `grimoire feature list` — see what features exist
3. `grimoire task list --status todo` — find available work
4. `grimoire task get <id>` — read the task details
5. `grimoire task update <id> --status in-progress` — claim it

### While working

- `grimoire log <id> "what you did"` — record progress
- `grimoire comment <id> "question"` — ask questions or flag issues
- `grimoire decision create --title "..." --body "..."` — record architectural decisions

### Finishing work

1. `grimoire log <id> "Completed implementation. Added tests."` — final log entry
2. `grimoire task update <id> --status done` — mark complete
3. `grimoire validate` — make sure nothing is broken

### Recording a decision

Decisions follow the ADR (Architecture Decision Record) pattern:

```bash
grimoire decision create --title "Use PostgreSQL over MongoDB" \
  --feature feat-a3f2k-user-authentication \
  --status accepted \
  --body "## Context
Need a database for user data and session storage.

## Decision
Use PostgreSQL for its strong consistency guarantees and mature ecosystem.

## Consequences
Requires running a PostgreSQL instance. Migrations needed for schema changes.

## Alternatives Considered
MongoDB was considered but rejected due to the relational nature of our data model."
```

---

## File layout

```
.grimoire/
  overview.md
  config.yaml
  features/
    feat-xxxxx-name.md
  requirements/
    req-xxxxx-name.md
  tasks/
    task-xxxxx-name.md
  decisions/
    adr-xxxxx-name.md
  .cache/          # gitignored — derived database
  .archive/        # deleted documents land here
```

The `.cache/` directory is gitignored. Everything else is committed to git.
