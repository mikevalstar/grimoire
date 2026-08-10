---
type: adr
title: "Frontend stack: React, shadcn/ui, TanStack Router and Query, Storybook"
description: React 19 + Tailwind with shadcn/ui components owned in-repo, TanStack Router for routing, TanStack Query for server state, Storybook for component review.
tags: [frontend, ui, tooling]
status: stable
generated: { by: okq/0.8.0, at: 2026-08-10 }
---

# Frontend stack: React, shadcn/ui, TanStack Router and Query, Storybook

## Status

Accepted.

## Context

`apps/web` is the single frontend for all three delivery targets
([ADR 0002](0002-one-http-api-three-delivery-targets.md)). It has a specific
visual design to hit, so components must be restyleable rather than themeable
around the edges; it is a data-heavy browsing UI over a remote API; and it must
run from `views://` in the desktop build as well as `/` on a server.

## Decision

- **React 19 + Vite + Tailwind 4** — already in place; Vite builds with
  `base: "./"` so one bundle serves both origins.
- **shadcn/ui** for components, installed via
  `bunx shadcn@latest add <name>`. The components land in our repo as source we
  own and restyle to match the design — that is the point of choosing it over a
  packaged library.
- **TanStack Router** for routing, typed routes over the API's resources.
- **TanStack Query** for server state: caching, invalidation, and background
  refetch against `/api`. No hand-rolled fetch-and-`useState`.
- **Storybook** for component review. Every new common component gets a story.

## Consequences

We own the component code, so upstream fixes are not free — restyling is cheap
and upgrading is manual. Storybook is a second build to keep green, and the
"add a story" rule only holds if it is enforced in review. Routing must be
configured for a file origin in the desktop build, where there is no server to
answer a deep link.

Payload types come from the shared Zod schemas rather than being written by
hand for the query layer — see
[ADR 0009](0009-zod-schemas-shared-between-api-and-client.md).
