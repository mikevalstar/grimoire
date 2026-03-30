---
id: "req-f6zc6-rest-api-for-core-operations"
uid: "f6zc6"
title: "REST API for Core Operations"
type: "requirement"
status: "draft"
priority: "high"
created: "2026-03-30"
updated: "2026-03-30"
tags:
  - api
  - server
  - infrastructure
feature: "feat-fv5ft-web-ui"
tasks: []
depends_on: []
---

# REST API for Core Operations

## Description

Expose the core library operations as REST API endpoints so the web UI can perform all document operations.

## Acceptance Criteria

- GET /api/documents — list documents with filters (type, status, priority, tag)
- GET /api/documents/:id — get single document with full content
- POST /api/documents — create new document
- PUT /api/documents/:id — update document fields and body
- DELETE /api/documents/:id — archive/delete document
- GET /api/search?q=&type=&limit= — keyword search
- GET /api/relationships/:id — document relationships
- GET /api/tree — feature/requirement/task hierarchy
- All endpoints return consistent JSON response format
- Error responses include meaningful status codes and messages

## Implementation Notes

- Each endpoint group as a Fastify route plugin in packages/server/src/routes/
- All endpoints call core library functions — no business logic in routes
- GET /api/status already exists as the pattern to follow

---

## Comments

---

## Changelog

### 2026-03-30 07:42 | grimoire

Document created.
