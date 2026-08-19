---
type: adr
title: Hardcover as a second source, with per-reader tokens
description: hardcover.app is Grimoire's second book source, reached only from the server over GraphQL, with an API token held per reader rather than per instance.
tags: [architecture, hardcover, users, security, sync]
status: stable
generated: { by: okq/0.8.0, at: 2026-08-14 }
---

# Hardcover as a second source, with per-reader tokens

## Status

Accepted. Extends [ADR 0011](0011-sync-calibre-into-grimoire-db-and-read-the-library-from-there.md),
which made `books` a record Grimoire owns and named a second source as the next
thing to arrive. [ADR 0005](0005-calibre-content-server-as-the-data-source.md)
stands: Calibre is still where the *files* live.

This ADR decides how Grimoire talks to Hardcover and whose credential it uses.
It deliberately does **not** decide how a Hardcover book and a Calibre book
become one row. See [Open](#open).

## Context

[ADR 0011](0011-sync-calibre-into-grimoire-db-and-read-the-library-from-there.md)
built `books` so that more than one source could write into it, and left the
matching problem for when a second source was real. [hardcover.app](https://hardcover.app)
is that source. It is not another copy of what Calibre has. Calibre knows the
files on a disk. Hardcover knows editions, covers, series, and the part that
matters here, what a *person* has read, is reading, and wants to read.

Four properties of their API force most of this decision
([their docs](https://docs.hardcover.app/api/getting-started/)):

- One GraphQL endpoint, `https://api.hardcover.app/v1/graphql`, authenticated by
  an `Authorization` header.
- **It refuses to be called from a browser.** Requests must come from somewhere
  that can keep the token secret. That is not a preference of ours to weigh, it
  is their rule.
- A token *is* the account. It reads and writes everything that account can,
  including deleting it. Their own docs put a "someone could delete your
  account with it" warning next to it.
- Tokens expire after a year, and the API is capped at 60 requests a minute.

Against that, Grimoire has several readers and no authentication at all
([ADR 0008](0008-multiple-users-without-authentication.md)). So "where does the
token live" is a real question rather than a formality: preferences already hold
every other setting, and putting it there would have been the smaller change.

## Decision

**Hardcover is a second source, and only `packages/api` talks to it.** The
browser never holds a token and never calls Hardcover, the same shape the
Calibre content server already has ([ADR 0002](0002-one-http-api-three-delivery-targets.md)).
Grimoire's own API is the only thing the UI talks to.

**The token belongs to a reader, not to the instance.** It is a
`hardcover_token` column on `users`, not a `hardcover.*` preference. A Hardcover
token is a person: shelves, progress, ratings and reviews behind it are theirs,
and any write we make later happens *as them*. One instance-wide token would
quietly file a household's reading under whoever set Grimoire up, and unpicking
that afterwards would mean re-linking every account anyway.

**The token never leaves the server.** `GET /api/users` says whether a reader is
linked, and to which Hardcover username. It does not carry the token, because
any browser that can reach Grimoire can read that response, and ADR 0008
promises nothing about who that is. Setting one is a dedicated write-only route.

**Grimoire stores a token only after it has authenticated.** Linking runs
`me { username }` first and refuses a token that does not answer. So a stored
token always has a known username beside it, and "is this reader linked?" is a
question the database can answer without a network call.

**Grimoire stores it in plaintext, and that is a deliberate limit.** There is no
master secret to encrypt it with and no login to derive one from, so anything we
did here would be obfuscation dressed as security. The boundary is the data
directory's file permissions ([ADR 0007](0007-user-data-and-asset-storage-location.md)),
the same boundary that already protects every reader's data.

## Consequences

Adding Hardcover becomes an additive change: a column, three routes and a probe,
with `books` untouched until we design matching. The UI gains no new capability
it could abuse, because it never sees a credential.

**A copy of `grimoire.db` is now a copy of everyone's Hardcover accounts.** It
was already personal data. It is now a credential store, and ADR 0008's warning
about not exposing a hosted instance to the internet gets sharper. That instance
can hand out `me`-shaped access to anyone who can reach it and knows a reader
id. Backups of the data directory inherit the same problem.

**Expiry is a state the UI has to carry.** A token dies after a year whether or
not anyone touches Grimoire, so "linked" can become "linked and rejected"
without any user action, and every surface that syncs has to report that as a
fixable condition rather than a failure.

**Sync fans out.** One Calibre library is one mirror. N linked readers are N
accounts, each with its own 60-requests-a-minute budget and its own idea of what
a book is. That cost lands on whoever designs the sync, not here.

## Open

**How a Hardcover book and a Calibre book become one book is not decided.**
`books.calibre_uuid` is a single-source identity column and will not stretch to
two ([ADR 0011](0011-sync-calibre-into-grimoire-db-and-read-the-library-from-there.md)'s
own open questions say so). Matching on ISBN, on title and author, or on an
explicit link table are all still open, as is whether `source` stays one value
per book. That decision gets its own ADR when the sync is real. This one only
establishes the connection it will need.

[Hardcover connection](../features/hardcover-connection.md) covers design and
behaviour.
