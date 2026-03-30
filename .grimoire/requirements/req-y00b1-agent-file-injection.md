---
id: "req-y00b1-agent-file-injection"
uid: "y00b1"
title: "Agent File Injection"
type: "requirement"
status: "done"
priority: "high"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - init
  - agents
feature: "feat-tpf5w-project-initialization-configuration"
tasks: []
depends_on: []
---

# Agent File Injection

**Parent Feature:** feat-tpf5w — Project Initialization & Configuration

## Description

During `grimoire init`, the CLI injects a grimoire reference section into `CLAUDE.md` or `AGENTS.md` using marker comments (`<!--GRIMOIRE START-->` / `<!--GRIMOIRE END-->`). This gives AI agents immediate awareness of grimoire commands.

## Acceptance Criteria

- Detects existing `CLAUDE.md` or `AGENTS.md` in the project root
- Injects a grimoire section with quick-reference CLI commands between marker tags
- On re-run, replaces content between markers rather than duplicating
- If neither file exists, creates `CLAUDE.md` with the section

---

## Comments

---

## Changelog

### 2026-03-30 20:07 | grimoire

Document created.
