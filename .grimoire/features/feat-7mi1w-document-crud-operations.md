---
id: "feat-7mi1w-document-crud-operations"
uid: "7mi1w"
title: "Document CRUD Operations"
type: "feature"
status: "in-progress"
priority: "high"
created: "2026-03-29"
updated: "2026-03-29"
tags:
  - core
  - cli
requirements: []
decisions: []
---

# Document CRUD Operations

Full create, read, update, and delete operations for all document types (feature, requirement, task, decision) plus the overview document.

## Scope

- \`grimoire <type> create\` — create documents with all frontmatter fields via flags, body via \`--body\` or stdin
- \`grimoire <type> get <id>\` — read full document content + metadata, with \`--metadata-only\` and \`--no-changelog\` options
- \`grimoire <type> list\` — list documents with filtering (status, priority, tag, feature) and sorting
- \`grimoire <type> update <id>\` — update any frontmatter field, replace or append to body
- \`grimoire <type> delete <id>\` — soft delete to \`.grimoire/.archive/\`, with \`--hard\` for permanent deletion
- \`grimoire overview\` / \`grimoire overview edit\` — read and edit the overview document
- Auto-generated IDs with nanoid + title slugs (e.g., feat-a3f2k-user-auth)
- Human mode: \`grimoire <type> new\` (interactive create), \`grimoire <type> edit <id>\` (opens \$EDITOR)

## Current Status

Create, get, list, and basic update are implemented. Delete, archive, and human-mode interactive commands are not yet implemented.

---

## Comments

---

## Changelog

### 2026-03-29 19:00 | grimoire

Document created.
