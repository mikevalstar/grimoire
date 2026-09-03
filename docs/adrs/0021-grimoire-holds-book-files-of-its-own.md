---
type: adr
title: Grimoire holds book files of its own
description: A reader can hand Grimoire a book file directly. It becomes a third source next to Calibre and Hardcover, stored under the data dir and keyed by Grimoire's own book id, and the data dir stops being disposable.
tags: [architecture, data, storage, upload, sync]
status: stable
generated: { by: okq/0.8.0, at: 2026-09-03 }
---

# Grimoire holds book files of its own

## Status

Accepted. Extends [ADR 0011](0011-sync-calibre-into-grimoire-db-and-read-the-library-from-there.md)
and [ADR 0012](0012-hardcover-as-a-second-source-with-per-reader-tokens.md),
which each added a source that writes into `books`. Amends
[ADR 0007](0007-user-data-and-asset-storage-location.md): the data dir now
holds originals, not only cached derivatives. ADR 0007's location rules stand.

## Context

Two sources feed the library today and neither is Grimoire's. Calibre knows
files it holds on a disk somewhere else; Hardcover knows what a person has
read. A book that is in neither has no way in. Someone with an EPUB in their
downloads folder has to open Calibre, import it there, and wait for a sync,
which is the workflow Grimoire exists to replace
([the long-term goal](../README.md)).

Every piece a third source needs is already built. `books.source` reserved
`grimoire` from the start, works group one book held by several sources
([ADR 0013](0013-group-duplicate-books-into-works.md)), and covers are cached
on disk under Grimoire's own book id. What is missing is the file, and a
decision about what holding one means.

ADR 0007 promised that everything under the data dir is a derivative Grimoire
can rebuild, so deleting the directory costs a re-sync. A book file someone
uploaded cannot be rebuilt from anywhere. Holding one changes what a backup of
the data dir is, and that is the part that needs deciding rather than the
upload itself.

## Decision

**A book file uploaded to Grimoire is a third source.** It is a `books` row
with `source = 'grimoire'`, matched into a work by the same matcher the other
two sources go through, and shown with its own mark. Nothing about the library
screens knows it is different.

**The file lives under the data dir, keyed by Grimoire's book id.** Files sit
in `books/<bucket>/<id>.<format>`, one file per format, bucketed the same way
covers are. Metadata edits never move a file, and the browser never learns a
path. A `book_files` table records each file's format, size, hash and who added
it, so "does Grimoire hold this format?" and "has this exact file been uploaded
before?" are questions the database answers.

**The data dir is no longer disposable.** ADR 0007's "delete it and Grimoire
rebuilds it" now costs every uploaded book. Backups of a hosted instance are a
real concern from this ADR on, and the directory's layout is a contract that
migrations must respect.

**Uploads are instance-wide.** Like Calibre's library and unlike Hardcover's
shelves, a file someone uploads is on the shelf for every reader
([ADR 0008](0008-multiple-users-without-authentication.md)). The reader who
uploaded it is recorded, not enforced.

**Identity is the file's hash.** Uploading the same bytes twice returns the
book that already holds them rather than a second copy. Two different files of
the same book are two entries, which is the same situation as two Calibre
editions, and the [duplicates queue](../features/resolving-duplicates.md)
already handles it.

**Formats are a registry, EPUB is the first entry.** Each format is a module
that says how to recognise a file and what metadata and cover it can extract.
The ingest path only speaks to the registry, so a second format is a second
module, and conversion between formats later is a function from one entry to
another writing a second `book_files` row.

**Deleting is real.** A Grimoire-sourced entry can be removed, taking its files
with it. The other members of its work are untouched, since their files were
never Grimoire's to remove. A work left with no members goes, and with it the
ratings and read states that hung off it. Calibre and Hardcover rows are not
deletable here, because a sync would only bring them back.

Design and behaviour are in [Uploading a book](../features/uploading-a-book.md).

## Consequences

A book gets into Grimoire without Calibre in the loop, which is the first step
toward not needing Calibre at all. The format registry keeps the second format,
multi-format uploads and conversion from being a redesign.

**Backups matter now.** An operator who treated the data dir as a cache loses
books. The [OPDS placeholder](../features/opds-catalog.md) assumed Grimoire
would never hold files and its downloads could always proxy Calibre; that
assumption is gone.

**Metadata quality is whatever the file says.** Calibre curates; an uploaded
EPUB carries what its publisher or converter wrote. A title in all caps or an
author in "Last, First" order lands on the shelf as is until Grimoire can edit
metadata, which this ADR does not add.

**Disk grows with uploads, without a ceiling.** Covers were three small JPEGs
a book. A picture book is hundreds of megabytes. The request cap is a guard
against accidents, not a quota.

Reverting means deleting the `grimoire` rows and the `books/` tree. Everything
else was already in place before this ADR.
