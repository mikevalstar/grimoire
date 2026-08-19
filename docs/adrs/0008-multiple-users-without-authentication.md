---
type: adr
title: Multiple users without authentication
description: One Calibre library, several Grimoire users. An X-Grimoire-User header set by a frontend user picker identifies them. No passwords, no sessions.
tags: [architecture, users, security]
status: stable
generated: { by: okq/0.8.0, at: 2026-08-10 }
---

# Multiple users without authentication

## Status

Accepted.

## Context

A household shares one Calibre library but not one reading position, shelf, or
rating. Grimoire needs per-user data ([ADR 0006](0006-grimoire-owned-sqlite-for-supplemental-data.md)).
Real authentication means password storage, sessions, and resets. That is a lot
of work aimed at a threat we do not have yet, since the first deployments are a
desktop app and a server on a trusted LAN.

## Decision

Multiple users, no authentication.

- Users are rows in `grimoire.db`; creating one takes a name.
- The frontend shows a user picker and remembers the last choice in
  `localStorage`. This is a convenience, not a credential.
- Every API request carries `X-Grimoire-User`. The API trusts it, resolves the
  user, and scopes per-user data to them. A missing header is an error for
  user-scoped routes, not a silent default.
- Library data from Calibre is shared and unscoped.

We fix the identity boundary now, as a header the server checks. Adding real
auth later then changes only how the header gets *established*, instead of
rewriting every route.

## Consequences

Users switch instantly and nothing is hidden from anyone: any client can claim
any user by setting a header, so this is a personalization boundary, not a
security one. **A hosted instance must not be exposed to the public internet**
without a reverse proxy handling auth in front of it. Per-user data is
separated on day one, so adding sessions later needs no data migration.
