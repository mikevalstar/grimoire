---
type: adr
title: One HTTP API, three delivery targets
description: Desktop, hosted server, and local web all run the same Hono API; no mode gets a private back door.
tags: [architecture, api]
status: stable
generated: { by: okq/0.8.0, at: 2026-08-10 }
---

# One HTTP API, three delivery targets

## Status

Accepted.

## Context

Grimoire ships three ways from one codebase: a desktop app, a self-hosted
server, and a local web app. The obvious failure mode is the desktop build
growing native shortcuts — direct file reads, IPC calls — that the hosted build
cannot have, after which the two drift into separate products.

## Decision

`packages/api` exports `createApi()`, returning a Hono app mounted at `/api`.
Every target embeds that same app: `apps/server` serves it alongside the built
web bundle, `apps/desktop` starts it in-process, and Vite proxies to it in dev.
The frontend talks HTTP and nothing else — no privileged bridge, no
mode-conditional data path.

The API opens the library lazily so it can boot unconfigured and answer 503
with a hint, which is what makes first-run setup work identically everywhere.

## Consequences

Any feature that works in one mode works in all three, and the API is testable
without a shell around it. The cost is that desktop-only capabilities (native
file dialogs, watching the library directory) must either be expressed as API
endpoints or kept strictly presentational. Local IPC also has real latency,
unlike a direct function call.

Related: [Electrobun for the desktop shell](0003-electrobun-for-the-desktop-shell.md),
[Calibre content server as the data source](0005-calibre-content-server-as-the-data-source.md).
