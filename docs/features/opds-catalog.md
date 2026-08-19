---
type: feature
title: OPDS catalog
description: Serve the Grimoire library as an OPDS feed so reader apps can browse it and download books directly. Placeholder for a future feature, nothing is built.
tags: [api, opds, library, calibre, future]
status: draft
generated: { by: okq/0.8.0, at: 2026-08-16 }
---

# OPDS catalog

> **Not implemented.** This is a placeholder recording the intent and the
> questions it raises, so the shape of the API doesn't drift somewhere that
> makes it hard later.

## Summary

Grimoire serves its library as an [OPDS](https://specs.opds.io/) catalog. A
reader app like KOReader, Moon+ Reader, Thorium or KyBook can point at a
Grimoire instance, browse the same shelf the web app shows, and download a book
straight onto the device.

## Motivation

Calibre's content server already speaks OPDS, so this is not about making the
files reachable. It is about making *Grimoire's* view of them reachable.
Everything Grimoire adds over Calibre lives in `grimoire.db`: read state,
ratings, per-reader shelves, works that group duplicates
([ADR 0013](../adrs/0013-group-duplicate-books-into-works.md)). A feed built
from Calibre's catalog cannot express "what I haven't read yet"; one built from
Grimoire's can, and that is the only reason to write another OPDS server.

It is also the cheapest path to reading on a device Grimoire will never ship a
client for. `bun run start:server` plus a feed URL is the whole install.

## Behavior

The serving direction is the one worth building. Grimoire as an OPDS
*consumer*, a third source next to Calibre and Hardcover, is a separate feature
and not what this note is about.

Sketch, to settle when someone designs this for real:

- A root navigation feed of the groupings the shelf already has
  ([sort and group](library-sort-and-group.md)): by author, by series, by tag,
  recently added. Plus the [read filters](marking-a-book-read.md) that only
  Grimoire knows: unread, currently reading, want to read.
- Acquisition feeds whose entries carry cover links and a download link per
  format.
- OPDS 1.2 (Atom XML) first, because that is what reader apps actually
  implement; OPDS 2.0 (JSON) alongside it if anything asks for it.
- Served from the same Hono app as everything else, under `/opds`, so it works
  identically in server, desktop and web builds
  ([ADR 0002](../adrs/0002-one-http-api-three-delivery-targets.md)).

Downloads proxy the running Calibre content server the way `/api/cs/*` already
does ([ADR 0005](../adrs/0005-calibre-content-server-as-the-data-source.md)).
Grimoire holds no book files of its own and should not start holding them for
this.

## Acceptance criteria

- [ ] A reader app can add a Grimoire instance as a catalog and browse it.
- [ ] A book downloads to the device, in a format Calibre holds for it.
- [ ] Feeds reflect Grimoire's own state, read status and per-reader shelves,
      not just Calibre's metadata.

## Open questions

- **Authentication.** OPDS clients do HTTP Basic and little else. Grimoire's
  [readers](settings.md) are names, not accounts with passwords, so there is
  nothing to authenticate with today. A feed is also the first thing here that
  would reach beyond a trusted LAN. Whose shelf a feed shows is the same
  question in a different hat.
- **Books with no file.** Hardcover-sourced rows have no acquisition link at
  all ([Hardcover sync](hardcover-sync.md)). Omitting them makes the feed
  disagree with the shelf; including them makes an entry nothing can download.
- **Grouped books.** A [work](book-matching.md) with two member rows is one
  card in the UI; an OPDS entry has to pick an edition to offer.
- **Covers.** The cached covers on disk are sized for the shelf
  ([ADR 0007](../adrs/0007-user-data-and-asset-storage-location.md)); whether a
  feed serves those or proxies Calibre's is unsettled.
- **Page-count limits.** Large libraries need paged feeds; which grouping is the
  entry point matters more when a reader app can't scroll ten thousand entries.
- **Search.** OPDS has an OpenSearch description document; mapping it onto
  [the quick filter](library-quick-filter.md) is optional but cheap.
