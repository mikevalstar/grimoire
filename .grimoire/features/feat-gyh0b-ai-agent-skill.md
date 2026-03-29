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

**Why:** AI agents need structured instructions to use grimoire effectively. Without a skill file, agents would need to discover CLI commands by trial and error, wasting tokens and producing inconsistent results.

## Scope

- Skill source lives at `skills/grimoire/SKILL.md`
- Users install via `npx skills add mikevalstar/grimoire`
- Covers: all CLI commands and flags, document types/statuses/priorities, document structure, recommended workflows, writing guidance, file layout
- `grimoire init` recommends installing the skill but does not manage skill files directly
- Published to agentskills.io registry

## Acceptance criteria

- Skill is installable via `npx skills add mikevalstar/grimoire`
- Skill covers all implemented CLI commands with accurate flags and examples
- Includes workflow guidance for common agent tasks
- Includes writing guidance for features and requirements
- Published and discoverable on agentskills.io

## Non-goals

- No IDE-specific integrations (skill is agent-agnostic)
- No auto-updating of installed skills when grimoire updates
