---
id: "req-v27tp-npm-distribution"
uid: "v27tp"
title: "npm Distribution"
type: "requirement"
status: "done"
priority: "high"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - publishing
  - npm
feature: "feat-tpf5w-project-initialization-configuration"
tasks: []
depends_on: []
---

# npm Distribution

**Parent Feature:** feat-tpf5w — Project Initialization & Configuration (cross-cutting)

## Description

The grimoire CLI is published to npm as `@grimoire-ai/cli`, allowing users to run it via `npx @grimoire-ai/cli`. The core library is published as `@grimoire-ai/core`.

## Acceptance Criteria

- `npx @grimoire-ai/cli --version` outputs the current version
- Package includes compiled CLI binary entry point
- All runtime dependencies are declared in package.json
- Publish workflow documented and repeatable

---

## Comments

---

## Changelog

### 2026-03-30 20:08 | grimoire

Document created.
