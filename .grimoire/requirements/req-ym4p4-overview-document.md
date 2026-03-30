---
id: "req-ym4p4-overview-document"
uid: "ym4p4"
title: "Overview Document"
type: "requirement"
status: "done"
priority: "medium"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - overview
  - crud
feature: "feat-tpf5w-project-initialization-configuration"
tasks: []
depends_on: []
---

# Overview Document

**Parent Feature:** feat-tpf5w — Project Initialization & Configuration

## Description

`grimoire overview` reads and displays the project overview document. `grimoire overview update` allows updating the overview's frontmatter and body content.

## Acceptance Criteria

- `grimoire overview` returns the full overview.md content as structured JSON
- `grimoire overview update` supports `--title`, `--description`, `--body`, `--add-tag`, `--remove-tag` flags
- Update preserves existing Comments and Changelog sections
- Returns error if `.grimoire/` is not initialized

---

## Comments

---

## Changelog

### 2026-03-30 20:07 | grimoire

Document created.
