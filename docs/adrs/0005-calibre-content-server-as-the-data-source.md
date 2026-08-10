---
type: adr
title: Calibre content server as the data source
description: All library data comes from a running Calibre content server via the API proxy; Grimoire does not read metadata.db directly.
tags: [architecture, calibre, data]
status: stable
generated: { by: okq/0.8.0, at: 2026-08-10 }
---

# Calibre content server as the data source

## Status

Accepted.

## Context

Calibre exposes a library two ways: the `metadata.db` SQLite file on disk, and
the content server's HTTP API. Reading the file directly is faster and needs
nothing running, but the schema is Calibre's private business, it changes
between releases, and concurrent access while Calibre is writing is a hazard we
would have to handle ourselves. Grimoire is read-only against Calibre for now —
Calibre stays the source of truth.

## Decision

Grimoire reads library data only through a running Calibre content server.
`packages/api` reverse-proxies it at `/api/cs/*` (`/api/cs/ajax/search`,
`/api/cs/ajax/books`, …). The target is resolved per request from the
`calibre.serverUrl` preference, falling back to `CALIBRE_SERVER` and then
`http://localhost:8080`, so changing it in the UI takes effect without a
restart. `POST /api/calibre/test` probes a candidate URL server-side, which also
keeps CORS out of the picture.

Direct `metadata.db` access is out. The existing `bun:sqlite` reader in
`packages/core` is superseded and should be removed. We may revisit direct
reads for bulk sync, but the default answer is no.

## Consequences

We are insulated from schema churn and from fighting Calibre for the file, and
one code path serves every delivery target. In return, Calibre must be running
for Grimoire to show anything — a real setup burden, and the reason first-run
setup collects and tests a server URL. We also inherit the content server's
query vocabulary and its per-request latency, which is what makes local
supplemental storage ([ADR 0006](0006-grimoire-owned-sqlite-for-supplemental-data.md))
worth having.
