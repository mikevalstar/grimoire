---
id: "req-s1anp-config-view-and-edit-command"
uid: "s1anp"
title: "Config View and Edit Command"
type: "requirement"
status: "draft"
priority: "medium"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-5
  - cli
  - config
feature: "feat-0k9iu-configuration-cli"
tasks: []
depends_on: []
---

# Config View and Edit Command

## Description

grimoire config — view, get, set, and list configuration values from config.yaml.

## Acceptance Criteria

- grimoire config --list: display all config values as flat key=value pairs (JSON in AI mode)
- grimoire config --get <key>: get a single value by dot-notation key (e.g., search.semantic_weight)
- grimoire config --set <key> <value>: update a value in config.yaml
- Dot-notation for nested keys: embedding.provider, ui.port, sync.auto_sync, etc.
- Type coercion: booleans (true/false), numbers, strings handled correctly
- Error on unknown keys with suggestion of valid keys
- Human mode (-i): interactive editor showing all settings with descriptions and current values
- Changes preserve YAML file structure and any comments

## Implementation Notes

- Use yaml library that preserves comments (e.g., yaml with custom options)
- Config schema should define valid keys, types, and defaults

---

## Comments

---

## Changelog

### 2026-03-30 19:19 | grimoire

Document created.
