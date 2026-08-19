---
type: feature
title: Hardcover connection
description: Each reader links their own hardcover.app account from settings. Paste an API token, test it, and see which Hardcover user it belongs to. The connection only; nothing syncs from it yet.
tags: [frontend, ui, configuration, hardcover, users]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-14 }
---

# Hardcover connection

## Summary

In [settings](settings.md), next to each reader, a place to paste a
[hardcover.app](https://hardcover.app) API token and prove it works. Grimoire
answers with the Hardcover username the token belongs to, and remembers the
link against that reader.

This is the connection and nothing more; moving books across it is
[Hardcover sync](hardcover-sync.md).

## Motivation

Hardcover is going to be Grimoire's second book source
([ADR 0012](../adrs/0012-hardcover-as-a-second-source-with-per-reader-tokens.md)).
Every part of that starts from a credential that works: reading it, matching it
against Calibre, writing back to it. Getting the credential in first, on its
own, means the hard part can be worked on against a real account instead of a
fixture. That hard part is deciding when a Hardcover book and a Calibre book
are the same book.

Linking is also the one piece that is genuinely per reader. The token is a
person, not a setting, and everything downstream inherits that shape.

## Behavior

### Where it lives

Under **Readers** in settings, on each reader's row: either the Hardcover
username they are linked to, or a **Link Hardcover** button. Anyone can link any
reader; there is no login to stop them
([ADR 0008](../adrs/0008-multiple-users-without-authentication.md)). The row
still makes it unambiguous whose account is being connected, which is the part
that actually matters.

Linking opens a token field, with a link to
[the page the token comes from](https://hardcover.app/account/api), a **Test**
button, and **Save**. The [first-run wizard](first-run-setup-wizard.md) offers
the same per-reader card as an optional step, so a household can link everyone
during setup.

- **Test** probes the token and reports back without storing anything.
- **Save** probes it too, and stores it only if it answered. A token Grimoire
  has saved is therefore always one that worked at least once.
- **Unlink** forgets the token and the username. It does not touch anything on
  Hardcover's side.

The token field is a password field, and the stored token is never shown again.
Redisplaying it would not be a new leak; there is simply nothing to do with it
here except replace it.

### Testing a link that already exists

Test with the field empty and Grimoire probes the stored token instead. This is
not padding. Hardcover tokens expire a year after they are issued, so a link
that has worked every day can stop working without anyone touching it. "Is this
still good?" needs an answer that doesn't require pasting the token again.

### What a probe is

One request, from the server, to `https://api.hardcover.app/v1/graphql`:

```graphql
query Test {
  me {
    username
  }
}
```

Success reports the username. That is proof the token belongs to the account
the reader thinks it does, which a bare "connected" tick would not give them.

Grimoire reports each failure as what it is, because they have different fixes.
A token Hardcover rejects (401), a rate limit (429, at 60 requests a minute), an
unreachable API, and a response that parsed but carried GraphQL errors are four
different messages.

Two details of their API get absorbed here rather than passed on to the reader.
Hardcover's own settings page hands out a token with `Bearer ` already on the
front, and people paste it that way about as often as not, so Grimoire accepts
both forms rather than failing with an unauthorized error that looks like a bad
token. Requests also carry a user agent naming Grimoire, which their docs ask
for.

### What the browser sees

Never the token. `GET /api/users` carries the Hardcover username and nothing
else, so the UI can render the link state without the credential ever reaching
it. See [ADR 0012](../adrs/0012-hardcover-as-a-second-source-with-per-reader-tokens.md).
Hardcover's API refuses browser-origin calls anyway, so every request runs
server-side in `packages/api`, the same way the Calibre proxy does.

## Data model

Two columns on `users` (`packages/core/src/db.ts`):

```sql
hardcover_token    TEXT,   -- the credential. Never leaves the server.
hardcover_username TEXT    -- who it belongs to; set by the probe that saved it
```

Both NULL for an unlinked reader, and always set or cleared together.
`hardcover_username IS NOT NULL` is the test for "linked", and it holds because
Grimoire only stores a token after a probe that returned a username.

Nothing here touches `books`. The second source's rows, and how they meet
Calibre's, wait for the matching design
([calibre sync](calibre-sync.md) lists the same question among its own).

## API

Reader-scoped by path rather than by the `X-Grimoire-User` header. This
administers one reader's link, and that reader is not always the one holding the
device.

- `PUT /api/users/:id/hardcover` takes `{ token }`. Probes first; 400 with the
  failure if it doesn't authenticate, otherwise stores it and answers with the
  updated reader.
- `DELETE /api/users/:id/hardcover` unlinks.
- `POST /api/users/:id/hardcover/test` takes `{ token? }`. Probes a candidate
  token, or the stored one when the body is empty. Never writes.

Every payload has a Zod schema in `packages/core/src/schemas.ts`
([ADR 0009](../adrs/0009-zod-schemas-shared-between-api-and-client.md)),
including the shape of Hardcover's own reply, parsed at the boundary so their
API changing breaks here, loudly, rather than three components deep.

## Acceptance criteria

- [ ] A reader can be linked to a Hardcover account from settings, and the
      username comes back from Hardcover rather than being typed. *(Needs a real
      token to confirm end to end; the rejection path is verified against the
      live API.)*
- [x] Test reports the specific failure without storing anything. A rejected
      token, a rate limit and an unreachable API read differently.
- [x] Save refuses a token that doesn't authenticate.
- [x] A token pasted with its `Bearer ` prefix works, in any casing.
- [x] Testing with an empty field re-probes the stored token, so an expired one
      can be found without pasting it again.
- [x] Unlink clears both columns and the row goes back to offering **Link
      Hardcover**.
- [x] No API response anywhere carries the token, `GET /api/users` included.
- [x] Each reader's link is independent; linking one leaves the others alone.
- [x] A database created before the columns existed gains them on open, without
      losing its readers.
- [x] The link control has a Storybook story covering linked, unlinked and
      failed.

## Open questions

- **Matching is still undecided.** [Hardcover sync](hardcover-sync.md) brings
  the books over, and [book matching](book-matching.md) groups a book held in
  both libraries under one work.
- **Expiry is only noticed when something asks.** Grimoire has no scheduled
  re-probe, so a link stays "connected" in the UI until a test or a sync tries
  it. Once syncing exists this wants the same treatment Calibre's failures get:
  a visible state that persists.
- **One account per reader.** Nothing models a reader with two Hardcover
  accounts, and nothing should until someone wants it.
- **No OAuth.** Hardcover's docs list it as planned. A pasted token is the only
  option today, and moving to OAuth later changes how the credential is obtained
  but not where it lives.
- **Unlinking leaves nothing behind to clean up now.** Once Hardcover has
  written rows into `books`, unlinking will have to answer what happens to them.
  Reader removal is already waiting on that same question
  ([settings](settings.md)).
