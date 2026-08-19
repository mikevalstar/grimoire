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
and cached assets such as book covers. Desktop users should never have to pick
a location. Server operators do need to put it on a specific volume and back it
up. Per-platform conventions differ, and following all of them gives us a path
nobody can state in one sentence.

## Decision

One directory holds both the database and cached assets:

- **Linux and macOS.** `~/.config/grimoire`. One path for both. We diverge from
  `~/Library/Application Support` on macOS to get a path users can type.
- **Windows.** Under the user's `Documents` folder.
- **Override.** `GRIMOIRE_DATA_DIR` wins everywhere. It is the supported knob
  for hosted deployments, and for pointing at a temp dir to exercise first-run
  setup without clobbering real preferences.

Assets are cached derivatives, never originals. Delete the directory and
Grimoire rebuilds it, losing only Grimoire-owned rows.

## Consequences

Docs, backups, and support answers name one path on every platform, and
containerized deploys need one env var. macOS purists will note the location is
non-standard, and Windows users get a directory in a folder they browse. We
took that trade on purpose. Nothing here is encrypted or access-controlled,
which matters given [multiple users share one instance](0008-multiple-users-without-authentication.md).
