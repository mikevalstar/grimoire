---
type: feature
title: Uploading a book
description: Drop an EPUB on the window, or pick one from the header's add menu, and Grimoire stores the file, reads its metadata and cover, and puts it on the shelf as a Grimoire-sourced book. Uploaded books can be deleted again.
tags: [frontend, ui, library, api, upload, storage]
status: draft
generated: { by: okq/0.8.0, at: 2026-09-03 }
---

# Uploading a book

## Summary

A reader drags a book file anywhere onto the window, or picks **Upload a
file** from the header's add menu, and the book lands on the shelf. Grimoire
keeps the file, reads title, authors, series, tags, description, identifiers
and cover out of it, and shows it as a Grimoire-sourced book with its own
mark. Only EPUB is accepted today. A Grimoire-sourced book can be deleted from
the [actions menu](book-actions.md), which removes its files.

## Motivation

Until now a book entered Grimoire only by way of Calibre or Hardcover. A file
in a downloads folder had to go through Calibre first, which is the tool
Grimoire means to replace
([ADR 0021](../adrs/0021-grimoire-holds-book-files-of-its-own.md)). This is
the first path where Grimoire is the source rather than a mirror of one.

## Behavior

**Two ways in.** The header's **+** is now an add menu with two entries:
**Upload a file** and **From Hardcover**. The first opens a file picker
limited to the formats Grimoire accepts. The second is the existing
[Hardcover add](adding-a-book-from-hardcover.md) and appears only for a
reader with a linked account. The menu is there for everyone, since uploading
needs no account. The [command palette](command-palette.md) carries both.

**Dropping.** Dragging a file over any part of the window shows a full-window
overlay saying what a drop will do. Dropping uploads every file dropped, one
after another. Dragging anything that is not a file, text out of the page for
one, shows nothing.

**Progress.** While files upload, a status strip at the bottom of the window
names the file in flight and how many are queued. Each file ends as added, as
already in the library, or as refused with the reason. A single successful
upload opens the new book's [details panel](book-details-panel.md), as the
Hardcover add does. Several uploads leave the shelf where it is.

**What Grimoire reads.** From the EPUB's package document: title and sort
title, authors and their sort form, series and position (Calibre's meta or
EPUB 3 collections), subjects as tags, publisher, language, publication date,
description, and identifiers (ISBN, Calibre's uuid, anything with a scheme).
The cover is whichever image the package names as one, scaled to the three
cached sizes like every other cover. A book with nothing usable in it still
lands, titled after its filename, so nothing dropped is silently lost.

**Where it goes.** Under the data dir, in `books/<bucket>/<id>.epub`, next to
the covers tree ([ADR 0007](../adrs/0007-user-data-and-asset-storage-location.md)).
A `book_files` row per file records format, size, SHA-256 and the reader who
uploaded it. The file is written whole under a temporary name and moved into
place only after it parsed, so a refused upload leaves nothing behind.

**The same file twice.** A file whose hash Grimoire already holds is not
stored again. The upload answers with the book that has it, marked as already
present, and its panel opens.

**A book already there from elsewhere.** The new entry goes through
[matching](book-matching.md) at once, so an EPUB of a book Calibre already
lists becomes a second entry of that work rather than a second card. The card
then wears both marks. A pair the matcher is unsure of goes to the
[duplicates queue](resolving-duplicates.md).

**Downloading.** The [download button](book-details-panel.md) offers
Grimoire's file alongside Calibre's formats. A format both sources hold is
served from Calibre, the source that ranks first everywhere else.

**Deleting.** The actions menu gains **Delete uploaded book**, enabled only
for a work with a Grimoire entry. It asks first, naming the file. Confirming
removes the Grimoire entry and its files. Other entries of the work stay, and
a work with nothing left is gone from the shelf along with its ratings and
read states. Calibre and Hardcover entries cannot be deleted from Grimoire,
because their sources would restore them on the next sync.

**Refusals.** Not an EPUB, over the size cap of 500 MB, or an EPUB with no
readable package document. Each is a plain sentence in the status strip.

**Formats.** EPUB only, in the first version. The API's format registry is
the one place that decides what is accepted and what can be read from it, so
adding a format does not touch the upload route or the UI.

## Acceptance criteria

- [x] Dropping an EPUB on the window uploads it and it appears on the shelf
      with a Grimoire mark.
- [x] The header add menu offers **Upload a file** for every reader, and
      **From Hardcover** only for a linked one.
- [x] Title, authors, series, tags, publisher, language, date, description,
      identifiers and cover are read from the file when present.
- [x] Uploading the same file twice yields one book and says it was already
      there.
- [x] An EPUB of a book Calibre already lists is grouped into that work.
- [x] The download button offers the uploaded file.
- [x] Deleting removes the entry and its files, leaves other entries alone,
      and drops an empty work.
- [x] A non-EPUB, an oversized file and a corrupt EPUB are refused with a
      reason, and leave no file on disk.
- [x] The source filter lists Grimoire once such a book exists.
- [x] The drop overlay, the add menu, the status strip and the delete dialog
      have Storybook stories.

## Open questions

- Editing metadata after upload. The file's metadata is what lands, and a
  Grimoire-sourced entry is the natural first place an editor would apply,
  since nothing overwrites it on sync.
- Multiple formats of one book, and conversion between them. The registry
  and `book_files` are shaped for both; neither is built.
- Re-extracting metadata from a file after the parser improves, without
  re-uploading.
- Whether an upload should offer a shelf and read date the way the Hardcover
  add does.
