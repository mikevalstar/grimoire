---
type: adr
title: Zod schemas shared between API and client
description: One Zod schema per API payload lives in packages/core; the API validates with it, the client parses with it, and both derive their types from it.
tags: [architecture, api, types, validation]
status: stable
generated: { by: okq/0.8.0, at: 2026-08-10 }
---

# Zod schemas shared between API and client

## Status

Accepted.

## Context

The frontend talks to the API over HTTP and nothing else
([ADR 0002](0002-one-http-api-three-delivery-targets.md)), so nothing checks
that the two agree. Today the shapes are hand-written TypeScript interfaces the
API casts to and the client casts from. The compiler is happy on both sides
while the wire format is whatever the server actually sent. Each route
hand-rolls its own request validation, and the call site casts payloads coming
through the Calibre content server proxy from `any`.

Version skew makes this worse than it would be in a normal monorepo. A hosted
server can be newer than the bundle a browser has cached, and a desktop build
ships its own frontend and API together but talks to a Calibre server it does
not control.

## Decision

[Zod](https://zod.dev) schemas are the single source of truth for every API
payload. They live in `packages/core/src/schemas.ts`, exported as
`@grimoire/core/schemas`. That file stays browser-safe, with no bun-only
imports, same rule as `types.ts`.

- **Types are derived, never written twice.** `z.infer<typeof X>` replaces the
  hand-written interface.
- **The API validates requests** with `@hono/zod-validator`, replacing the
  per-route checks.
- **The client parses responses** with the same schema before handing data to
  TanStack Query ([ADR 0004](0004-frontend-stack-react-shadcn-ui-tanstack-router-and-query-storybook.md)).
  A parse failure is an error the query layer surfaces, not a silent `undefined`
  three components deep.
- **Content-server payloads get schemas too.** Anything we read out of
  `/api/cs/*` is external and unversioned
  ([ADR 0005](0005-calibre-content-server-as-the-data-source.md)); parsing it at
  the boundary is where a Calibre upgrade should break, loudly.

## Consequences

Wire-format drift becomes a caught error with a path to the offending field
instead of a crash somewhere downstream, and adding a field means editing one
schema. Zod ships to the browser, costing bundle size, and every response pays
a parse. Schemas must stay tolerant of fields we do not model, Calibre's
included, so we never write them strict by default.

This does not give us compile-time coupling between a route and its client
call; the schema is shared, but the URL and method are still strings on both
sides.
