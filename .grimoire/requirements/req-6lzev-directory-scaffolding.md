---
id: "req-6lzev-directory-scaffolding"
uid: "6lzev"
title: "Directory Scaffolding"
type: "requirement"
status: "done"
priority: "high"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - init
feature: "feat-tpf5w-project-initialization-configuration"
tasks: []
depends_on: []
---

# Directory Scaffolding

**Parent Feature:** feat-tpf5w — Project Initialization & Configuration

## Description

`grimoire init` creates the full `.grimoire/` directory structure with all required subdirectories, an initial overview.md, and a config.yaml with sensible defaults.

## Acceptance Criteria

- Creates `.grimoire/` at project root
- Creates subdirectories: `features/`, `requirements/`, `tasks/`, `decisions/`, `.cache/`
- Generates `overview.md` with YAML frontmatter and empty Comments/Changelog sections
- Generates `config.yaml` with default configuration values
- AI mode requires `--name` flag; errors if missing
- Idempotent — running init on an already-initialized project does not overwrite existing files

---

## Comments

---

## Changelog

### 2026-03-30 20:07 | grimoire

Document created.
