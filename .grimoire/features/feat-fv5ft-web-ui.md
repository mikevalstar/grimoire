---
id: "feat-fv5ft-web-ui"
uid: "fv5ft"
title: "Web UI"
type: "feature"
status: "proposed"
priority: "medium"
created: "2026-03-29"
updated: "2026-03-29"
tags:
  - ui
  - web
requirements: []
decisions: []
---

# Web UI

**Why:** CLI is great for AI agents but humans need a visual interface to browse, edit, and understand the relationships between documents. A local web UI makes grimoire accessible to non-technical stakeholders and provides graph visualization that terminals can't.

## Scope

- `grimoire ui` — launch Fastify server serving a React+Vite SPA
- Options: `--port` (default 4444), `--no-open`
- Visual document browsing and editing
- Relationship graph visualization
- Search interface
- Dashboard with project status overview
- REST API backed by the same core library as the CLI

## Acceptance criteria

- `grimoire ui` launches server and opens browser
- All document types viewable and editable through the UI
- Relationship graph renders as an interactive visualization
- Search works from the UI
- REST API covers all core library operations

## Non-goals

- No multi-user / collaborative editing
- No hosted/cloud version — local only
- No authentication (local tool, trusts localhost)
