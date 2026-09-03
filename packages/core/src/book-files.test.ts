import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BookFilesStore } from "./book-files.ts";
import { BooksStore } from "./books.ts";
import { openDatabase } from "./db.ts";
import { matchKey } from "./matching.ts";
import { WorksStore } from "./works.ts";

const NOW = "2026-09-02T00:00:00.000Z";

let db: Database;
let dataDir: string;
let books: BooksStore;
let files: BookFilesStore;

beforeEach(async () => {
  db = openDatabase(":memory:");
  dataDir = await mkdtemp(join(tmpdir(), "grimoire-files-"));
  books = new BooksStore(db);
  files = new BookFilesStore(db, dataDir);
});

afterEach(async () => {
  db.close();
  await rm(dataDir, { recursive: true, force: true });
});

/** An upload that has made it through the parser, written to a temp file. */
async function upload(title: string, contents = title) {
  const temp = await files.tempPath();
  await writeFile(temp, contents);
  const { bookId, workId } = books.insertUpload(
    { title, authors: ["Ursula K. Le Guin"], tags: [], languages: [], identifiers: {} },
    NOW,
  );
  await files.add(
    temp,
    {
      bookId,
      format: "epub",
      size: contents.length,
      sha256: `sha-${contents}`,
      originalName: `${title}.epub`,
      addedBy: null,
    },
    NOW,
  );
  return { bookId, workId };
}

/** A synced Calibre row in a work of its own, for the matcher to find. */
function calibreBook(title: string): { workId: number; bookId: number } {
  const work = db
    .query("INSERT INTO works (created_at) VALUES ($now) RETURNING id")
    .get({ $now: NOW }) as { id: number };
  const book = db
    .query(
      `INSERT INTO books (source, calibre_uuid, calibre_id, title, authors, match_key, work_id, added, created_at, updated_at)
       VALUES ('calibre', $uuid, 1, $title, $authors, $key, $workId, $now, $now, $now) RETURNING id`,
    )
    .get({
      $uuid: crypto.randomUUID(),
      $title: title,
      $authors: JSON.stringify(["Ursula K. Le Guin"]),
      $key: matchKey(title),
      $workId: work.id,
      $now: NOW,
    }) as { id: number };
  return { workId: work.id, bookId: book.id };
}

describe("adding a file", () => {
  test("moves it into the id-bucketed tree and records the row", async () => {
    const { bookId, workId } = await upload("The Dispossessed");
    const held = files.get(bookId, "EPUB");
    expect(held).toMatchObject({ bookId, format: "EPUB", originalName: "The Dispossessed.epub" });
    expect((await stat(files.path(bookId, "EPUB"))).size).toBe("The Dispossessed".length);
    expect(files.path(bookId, "EPUB").startsWith(join(dataDir, "books"))).toBe(true);

    const book = books.get(workId);
    expect(book?.sources).toEqual(["grimoire"]);
    expect(book?.formats).toEqual(["EPUB"]);
    expect(book?.uploadedFormats).toEqual(["EPUB"]);
    expect(book?.calibreId).toBeNull();
  });

  test("finds the same bytes again by hash", async () => {
    const { bookId, workId } = await upload("The Dispossessed");
    expect(files.findBySha256("sha-The Dispossessed")).toEqual({ bookId, workId });
    expect(files.findBySha256("sha-other")).toBeNull();
  });

  test("a Calibre copy of the same book is grouped into one work by the matcher", async () => {
    const calibre = calibreBook("The Dispossessed");
    const { bookId } = await upload("The Dispossessed");
    new WorksStore(db).matchAll();

    expect(books.workIdOf(bookId)).toBe(calibre.workId);
    const book = books.get(calibre.workId);
    expect(book?.sources).toEqual(["calibre", "grimoire"]);
    expect(book?.uploadedFormats).toEqual(["EPUB"]);
    // Calibre's id is what the download button reads first.
    expect(book?.calibreId).toBe(1);
  });
});

describe("deleting uploads", () => {
  test("removes the file, the row, and a work left with nothing", async () => {
    const { bookId, workId } = await upload("The Dispossessed");
    db.query("INSERT INTO users (name, color, created_at) VALUES ('Mike', 'indigo', $now)").run({
      $now: NOW,
    });
    db.query(
      "INSERT INTO ratings (user_id, work_id, rating, updated_at) VALUES (1, $workId, 4, $now)",
    ).run({ $workId: workId, $now: NOW });

    expect(books.uploadedMembers(workId)).toEqual([{ id: bookId, title: "The Dispossessed" }]);
    await files.removeFiles(bookId);
    books.deleteMembers([bookId]);

    expect(books.get(workId)).toBeNull();
    expect(files.get(bookId, "EPUB")).toBeNull();
    await expect(stat(files.path(bookId, "EPUB"))).rejects.toThrow();
    expect(db.query("SELECT count(*) AS n FROM works").get()).toEqual({ n: 0 });
    expect(db.query("SELECT count(*) AS n FROM ratings").get()).toEqual({ n: 0 });
  });

  test("leaves the other members of a shared work alone", async () => {
    const calibre = calibreBook("The Dispossessed");
    const { bookId } = await upload("The Dispossessed");
    new WorksStore(db).matchAll();

    books.deleteMembers([bookId]);

    const book = books.get(calibre.workId);
    expect(book?.sources).toEqual(["calibre"]);
    expect(book?.uploadedFormats).toEqual([]);
  });

  test("never deletes a synced row", () => {
    const calibre = calibreBook("The Dispossessed");
    books.deleteMembers([calibre.bookId]);
    expect(books.get(calibre.workId)).not.toBeNull();
    expect(books.uploadedMembers(calibre.workId)).toEqual([]);
  });
});
