---
id: "feat-0k9iu-configuration-cli"
uid: "0k9iu"
title: "Configuration CLI"
type: "feature"
status: "proposed"
priority: "medium"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-5
  - cli
  - config
requirements:
  - req-s1anp-config-view-and-edit-command
decisions: []
---

# Configuration CLI

**Why:** Users need a way to view and modify grimoire configuration without hand-editing YAML. A config command makes it easy to change settings like search weights, embedding provider, UI port, etc.

## Scope

- grimoire config --list: show all configuration values
- grimoire config --get <key>: get a specific value
- grimoire config --set <key> <value>: set a specific value
- Human mode (-i): interactive config editor showing current values

## Acceptance criteria

- All config.yaml values readable and writable via CLI
- Dot-notation keys for nested values (e.g., search.semantic_weight)
- Changes written back to config.yaml preserving comments and structure
- Human mode shows an interactive editor with current values and descriptions
- Invalid keys or values produce clear error messages

## Non-goals

- No config profiles or environments
- No config validation beyond type checking

---

## Comments

---

## Changelog

### 2026-03-30 19:18 | grimoire

Document created.
