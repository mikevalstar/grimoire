---
id: "req-nghbo-fastify-server-with-static-asset-serving"
uid: "nghbo"
title: "Fastify Server with Static Asset Serving"
type: "requirement"
status: "done"
priority: "high"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - server
  - fastify
  - infrastructure
feature: "feat-fv5ft-web-ui"
tasks: []
depends_on: []
---

# Fastify Server with Static Asset Serving

## Description

Set up a Fastify HTTP server that serves the React SPA as static assets and provides API routes backed by the core library.

## Acceptance Criteria

- Fastify server listens on configurable port (default 4444)
- Serves built SPA from website dist directory
- SPA fallback routing (non-API routes return index.html)
- CORS enabled for development
- @fastify/static and @fastify/cors plugins configured
- Server exports createServer() and startServer() functions for reuse

## Implementation Notes

- Server package lives at packages/server/
- Thin wrapper around core library — no business logic in server layer
- API routes registered as Fastify plugins

---

## Comments

---

## Changelog

### 2026-03-30 07:42 | grimoire

Document created.
