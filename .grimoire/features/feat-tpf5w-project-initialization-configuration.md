---
id: "feat-tpf5w-project-initialization-configuration"
uid: "tpf5w"
title: "Project Initialization & Configuration"
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

# Project Initialization & Configuration

**Why:** Grimoire needs a zero-friction setup experience. A single `grimoire init` should get any project from nothing to a working `.grimoire/` directory with sensible defaults, so teams can start capturing knowledge immediately.

## Scope

- `grimoire init` — creates `.grimoire/` with overview.md, config.yaml, and subdirectories
- AI mode: requires `--name`, errors if missing
- Human mode: prompts for name and description
- Updates `.gitignore` to exclude `.grimoire/.cache/`
- Recommends installing the AI agent skill via `npx skills add mikevalstar/grimoire`
- `grimoire config` — view/edit configuration (embedding provider, search defaults, UI port, sync settings, ID generation)

## Acceptance criteria

- `grimoire init` creates complete directory structure in one command
- Overview document is populated with project name
- `.gitignore` is updated for `.cache/`
- Init is idempotent (safe to re-run)
- Config command can read and write all config keys

## Non-goals

- No migration from other requirements tools during init
- No template system for different project types
