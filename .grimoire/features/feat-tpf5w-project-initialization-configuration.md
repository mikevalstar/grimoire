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

The \`grimoire init\` command sets up the \`.grimoire/\` directory structure in a project, creating the overview document, config file, and all subdirectories. The \`grimoire config\` command allows viewing and editing settings.

## Scope

- \`grimoire init\` — creates \`.grimoire/\` with overview.md, config.yaml, and subdirectories (features/, requirements/, tasks/, decisions/, .cache/)
- AI mode: requires \`--name\`, errors if missing
- Human mode: prompts for name and description
- Updates \`.gitignore\` to exclude \`.grimoire/.cache/\`
- Recommends installing the AI agent skill via \`npx skills add mikevalstar/grimoire\`
- \`grimoire config\` — view/edit configuration (embedding provider, search defaults, UI port, sync settings, ID generation)

## Current Status

Init command is implemented and working. Config command is not yet implemented.

---

## Comments

---

## Changelog

### 2026-03-29 19:00 | grimoire

Document created.
