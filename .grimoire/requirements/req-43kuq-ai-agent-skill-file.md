---
id: "req-43kuq-ai-agent-skill-file"
uid: "43kuq"
title: "AI Agent Skill File"
type: "requirement"
status: "done"
priority: "high"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - skill
  - agents
feature: "feat-gyh0b-ai-agent-skill"
tasks: []
depends_on: []
---

# AI Agent Skill File

**Parent Feature:** feat-gyh0b — AI Agent Skill

## Description

A single comprehensive `skills/grimoire/SKILL.md` file following the agentskills.io convention. Provides AI agents with complete instructions for using grimoire.

## Acceptance Criteria

- Lives at `skills/grimoire/SKILL.md` in the repo
- YAML frontmatter with `name` and `description` fields
- Description controls agent trigger context
- Body covers: all CLI commands and flags, document types/statuses/priorities, document structure (frontmatter + body + comments + changelog), recommended workflows, writing guidance
- Installable via `npx skills add mikevalstar/grimoire`
- `grimoire init` recommends installation but does not copy skill files

---

## Comments

---

## Changelog

### 2026-03-30 20:08 | grimoire

Document created.
