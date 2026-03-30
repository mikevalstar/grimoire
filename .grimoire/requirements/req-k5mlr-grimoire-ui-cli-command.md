---
id: "req-k5mlr-grimoire-ui-cli-command"
uid: "k5mlr"
title: "grimoire ui CLI Command"
type: "requirement"
status: "done"
priority: "high"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - cli
  - server
feature: "feat-fv5ft-web-ui"
tasks: []
depends_on: []
---

# grimoire ui CLI Command

## Description

CLI command to launch the web UI server and optionally auto-open the browser.

## Acceptance Criteria

- `grimoire ui` launches the Fastify server
- `--port <port>` flag overrides default port (4444)
- `--no-open` flag prevents auto-opening browser
- Reads port and auto_open from config.yaml ui section
- Resolves website dist directory relative to CLI package
- Prints server URL to console on start

## Implementation Notes

- Command lives at apps/cli/src/commands/ui.ts
- Uses startServer() from @grimoire-ai/server package

---

## Comments

---

## Changelog

### 2026-03-30 07:42 | grimoire

Document created.
