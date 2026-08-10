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
reading progress, per-user annotations. We also pay a network round trip for
every Calibre query, which is a poor fit for data we sort and filter on
constantly.

## Decision

Grimoire owns a writable SQLite database, `grimoire.db`, accessed through
`packages/core` (`SettingsStore` today). It holds:

- Grimoire-only data, keyed by Calibre book id.
- Synced copies of Calibre data where a local copy buys something real —
  fast list rendering, sorting, offline browsing. Calibre stays authoritative;
  a sync row is a cache, never a second source of truth.

Merging happens in `packages/api`, server-side, so the frontend receives one
shape and does not know which field came from where.

## Consequences

Features that Calibre cannot express become possible without forking it, and
list views can be fast. The costs are the usual ones for a cache: sync has to be
written, staleness has to be reasoned about, and Calibre ids must stay stable —
a book removed and re-added in Calibre orphans our rows. Writes go only to
`grimoire.db`; anything requiring a Calibre write is out of scope.

Location and override rules are in
[User data and asset storage location](0007-user-data-and-asset-storage-location.md).
