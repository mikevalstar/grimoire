---
id: "req-upy6j-file-watcher-for-live-sync"
uid: "upy6j"
title: "File Watcher for Live Sync"
type: "requirement"
status: "draft"
priority: "low"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - server
  - sync
  - infrastructure
feature: "feat-fv5ft-web-ui"
tasks: []
depends_on: []
---

# File Watcher for Live Sync

## Description

When the web UI server is running, watch .grimoire/ for file changes and automatically re-sync the DuckDB database so the UI stays current.

## Acceptance Criteria

- Watch .grimoire/ directory for file creation, modification, and deletion
- Trigger incremental sync when markdown files change
- Debounce rapid changes (e.g., 500ms window)
- UI reflects changes without manual page refresh (polling or WebSocket push)
- Configurable via sync.watch in config.yaml
- File watcher only active when server is running (not during CLI usage)

## Implementation Notes

- Consider node:fs.watch, chokidar, or similar
- Could use Server-Sent Events or WebSocket for push, or simple polling from frontend
- Auto-sync on CLI commands is separate and already exists

---

## Comments

---

## Changelog

### 2026-03-30 07:43 | grimoire

Document created.
