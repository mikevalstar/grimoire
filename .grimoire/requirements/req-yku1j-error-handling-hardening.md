---
id: "req-yku1j-error-handling-hardening"
uid: "yku1j"
title: "Error Handling Hardening"
type: "requirement"
status: "draft"
priority: "high"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - phase-5
  - polish
  - ux
feature: "feat-ctlqq-production-readiness-v1-0"
tasks: []
depends_on: []
---

# Error Handling Hardening

## Description

Review and improve error messages across all CLI commands to provide helpful context and actionable suggestions.

## Acceptance Criteria

- All errors include: what went wrong, why, and what to do about it
- Common errors have specific messages (e.g., "No .grimoire/ directory found — run grimoire init first")
- Missing required flags produce usage hints
- File I/O errors include the path that failed
- DuckDB errors are caught and translated to user-friendly messages
- AI mode: errors as structured JSON { error: string, code: string, suggestion: string }
- No stack traces in production output (only with --debug flag)
- Exit codes are meaningful and documented

## Implementation Notes

- Audit all try/catch blocks and error paths
- Create a shared error formatter that handles both AI and interactive modes

---

## Comments

---

## Changelog

### 2026-03-30 19:19 | grimoire

Document created.
