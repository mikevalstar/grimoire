---
id: "feat-7mi1w-document-crud-operations"
uid: "7mi1w"
title: "Document CRUD Operations"
type: "feature"
status: "complete"
priority: "high"
created: "2026-03-29"
updated: "2026-03-30"
tags:
  - core
  - cli
requirements: []
decisions: []
---

# Document CRUD Operations

**Why:** The core data access layer — without CRUD, nothing else works. Every other feature depends on being able to create, read, update, and delete documents programmatically.

## Scope

- `grimoire <type> create` — create documents with frontmatter fields via flags, body via `--body` or stdin
- `grimoire <type> get <id>` — read document with `--metadata-only` and `--no-changelog` options
- `grimoire <type> list` — list with filtering (status, priority, tag, feature) and sorting
- `grimoire <type> update <id>` — update any frontmatter field, replace or append to body
- `grimoire <type> delete <id>` — soft delete to `.grimoire/.archive/`, `--hard` for permanent
- `grimoire overview` / `grimoire overview edit` — read and edit the overview
- Auto-generated IDs: nanoid + title slugs (e.g., feat-a3f2k-user-auth)
- Human mode: `grimoire <type> new` (interactive create), `grimoire <type> edit <id>` (opens $EDITOR)

## Acceptance criteria

- All five document types support create, get, list, update, delete
- Filtering and sorting work on list commands
- Soft delete moves to `.archive/`, hard delete removes permanently
- IDs are auto-generated and unique
- Human mode commands open interactive prompts / $EDITOR

## Non-goals

- No batch operations (bulk create/update/delete)
- No undo/history beyond git
