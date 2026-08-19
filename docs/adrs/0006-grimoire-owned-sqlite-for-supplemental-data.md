---
type: adr
title: Grimoire-owned SQLite for supplemental data
description: Grimoire keeps its own writable SQLite db for data Calibre has no place for, merged with Calibre data at the API layer.
tags: [architecture, data, storage]
status: stable
generated: { by: okq/0.8.0, at: 2026-08-10 }
---

# Grimoire-owned SQLite for supplemental data

## Status

Accepted.

## Context

Calibre is read-only to us ([ADR 0005](0005-calibre-content-server-as-the-data-source.md))
and does not model everything Grimoire wants: preferences, users, shelves,
reading progress, per-user annotations. Every Calibre query also costs a network
round trip, a bad deal for data we sort and filter on constantly.

## Decision

Grimoire owns a writable SQLite database, `grimoire.db`, reached through
`packages/core` (`SettingsStore` today). It holds:

- Grimoire-only data, keyed by Calibre book id.
- Synced copies of Calibre data where a local copy buys something real: fast
  list rendering, sorting, offline browsing. Calibre stays authoritative. A sync
  row is a cache, never a second source of truth.

`packages/api` merges the two server-side, so the frontend gets one shape and
never learns which field came from where.

## Consequences

We can build features Calibre cannot express without forking it, and list views
can be fast. The costs are the usual ones for a cache. Someone has to write the
sync, staleness becomes a thing to reason about, and Calibre ids have to stay
stable. A book removed and re-added in Calibre orphans our rows. Writes go only
to `grimoire.db`. Anything that needs a Calibre write is out of scope.

Location and override rules live in
[User data and asset storage location](0007-user-data-and-asset-storage-location.md).
