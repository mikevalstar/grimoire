---
type: adr
title: User data and asset storage location
description: grimoire.db and cached assets live in ~/.config/grimoire on Linux and macOS, Documents on Windows, overridable with GRIMOIRE_DATA_DIR.
tags: [storage, configuration, operations]
status: stable
generated: { by: okq/0.8.0, at: 2026-08-10 }
---

# User data and asset storage location

## Status

Accepted.

## Context

Grimoire writes `grimoire.db` ([ADR 0006](0006-grimoire-owned-sqlite-for-supplemental-data.md))
and cached assets such as book covers. Desktop users expect this to land
somewhere sane without being asked; server operators need to put it on a
specific volume and back it up. Per-platform conventions differ, and following
all of them makes the path hard to talk about and hard to document.

## Decision

One directory holds both the database and cached assets:

- **Linux and macOS** — `~/.config/grimoire`. One path for both; we accept the
  divergence from `~/Library/Application Support` on macOS in exchange for a
  path users can type.
- **Windows** — under the user's `Documents` folder.
- **Override** — `GRIMOIRE_DATA_DIR` wins everywhere. This is the supported
  knob for hosted deployments and for pointing at a temp dir to exercise
  first-run setup without clobbering real preferences.

Assets are cached derivatives, never originals: the directory can be deleted
and rebuilt, losing only Grimoire-owned rows.

## Consequences

Documentation, backups, and support answers are one path on every platform, and
containerized deploys need one env var. macOS purists will note the location is
non-standard, and Windows users get a directory in a folder they browse — the
tradeoff is deliberate. Nothing here is encrypted or access-controlled, which
matters given [multiple users share one instance](0008-multiple-users-without-authentication.md).
