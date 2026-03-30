---
id: "req-8cpci-readme-and-documentation-site"
uid: "8cpci"
title: "README and Documentation Site"
type: "requirement"
status: "draft"
priority: "medium"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-5
  - docs
  - website
feature: "feat-ctlqq-production-readiness-v1-0"
tasks: []
depends_on: []
---

# README and Documentation Site

## Description

Create a comprehensive README for the GitHub repo and a documentation site at grimoireai.quest.

## Acceptance Criteria

- README.md covers: what grimoire is, installation, quickstart (init → create → search), AI agent usage, web UI, configuration
- README includes badges: npm version, license, CI status
- grimoireai.quest serves documentation with: getting started guide, CLI reference, document schema reference, configuration reference, AI agent integration guide
- Documentation site is static (e.g., VitePress, Astro, or similar)
- Documentation stays in sync with CLI --help and SKILL.md

## Implementation Notes

- README should be concise — link to docs site for details
- Consider auto-generating CLI reference from commander help output
- Domain grimoireai.quest is already owned

---

## Comments

---

## Changelog

### 2026-03-30 19:19 | grimoire

Document created.
