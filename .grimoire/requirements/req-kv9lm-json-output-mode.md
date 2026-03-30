---
id: "req-kv9lm-json-output-mode"
uid: "kv9lm"
title: "JSON Output Mode"
type: "requirement"
status: "done"
priority: "high"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - cli
  - ai-mode
feature: "feat-7mi1w-document-crud-operations"
tasks: []
depends_on: []
---

# JSON Output Mode

**Parent Feature:** feat-7mi1w — Document CRUD Operations (cross-cutting across all CLI commands)

## Description

All CLI commands output structured JSON by default (AI mode). This ensures AI agents can reliably parse grimoire output without screen-scraping.

## Acceptance Criteria

- JSON is the default output format for all commands
- Consistent response shape: success operations include relevant data, errors include `error` field with message
- No interactive prompts in AI mode — all input via flags or stdin
- Commands exit with meaningful status codes (0 = success, 1 = error)
- Output is valid JSON parseable by `JSON.parse()`

---

## Comments

---

## Changelog

### 2026-03-30 20:08 | grimoire

Document created.
