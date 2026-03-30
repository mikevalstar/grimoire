---
id: "req-ua6df-gitignore-management"
uid: "ua6df"
title: "Gitignore Management"
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

# Gitignore Management

**Parent Feature:** feat-tpf5w — Project Initialization & Configuration

## Description

During `grimoire init`, the CLI checks the project's `.gitignore` and ensures `.grimoire/.cache/` is excluded from version control.

## Acceptance Criteria

- If `.gitignore` exists, appends `.grimoire/.cache/` if not already present
- If `.gitignore` does not exist, creates one with the entry
- Does not duplicate the entry on repeated runs

---

## Comments

---

## Changelog

### 2026-03-30 20:07 | grimoire

Document created.
