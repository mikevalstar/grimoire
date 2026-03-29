---
id: "feat-gyh0b-ai-agent-skill"
uid: "gyh0b"
title: "AI Agent Skill"
type: "feature"
status: "complete"
priority: "high"
created: "2026-03-29"
updated: "2026-03-29"
tags:
  - ai
  - agentskills
requirements: []
decisions: []
---

# AI Agent Skill

Grimoire ships a single AI agent skill via the agentskills.io convention. The skill provides AI coding agents with instructions on how to use grimoire CLI commands, document types, workflows, and conventions.

## Scope

- Skill source lives at \`skills/grimoire/SKILL.md\`
- Users install via \`npx skills add mikevalstar/grimoire\`
- Covers: all CLI commands and flags, document types/statuses/priorities, document structure, recommended workflows, file layout
- \`grimoire init\` recommends installing the skill but does not manage skill files directly
- Published to agentskills.io registry

## Current Status

Complete. Skill is published and installable.

---

## Comments

---

## Changelog

### 2026-03-29 19:01 | grimoire

Document created.
