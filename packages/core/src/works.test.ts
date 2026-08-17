import type { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { openDatabase } from "./db.ts";
import { matchKey } from "./matching.ts";
import { WorksStore } from "./works.ts";

const NOW = "2026-01-01T00:00:00.000Z";

let db: Database;
let works: WorksStore;

/** A work of its own, with one book row in it. Answers the work's id. */
function addBook(options: {
  source: string;
  title: string;
  authors?: string[];
  pinned?: boolean;
}): { workId: number; bookId: number } {
  const work = db
    .query("INSERT INTO works (created_at) VALUES ($now) RETURNING id")
    .get({ $now: NOW }) as { id: number };

  const book = db
    .query(
      `INSERT INTO books (source, title, authors, match_key, work_id, work_pinned, added, created_at, updated_at)
       VALUES ($source, $title, $authors, $key, $workId, $pinned, $now, $now, $now) RETURNING id`,
    )
    .get({
      $source: options.source,
      $title: options.title,
      $authors: JSON.stringify(options.authors ?? ["Ursula K. Le Guin"]),
      $key: matchKey(options.title),
      $workId: work.id,
      $pinned: options.pinned ? 1 : 0,
      $now: NOW,
    }) as { id: number };

  return { workId: work.id, bookId: book.id };
}

function addUser(name: string): number {
  return (
    db
      .query(
        "INSERT INTO users (name, color, created_at) VALUES ($name, '#fff', $now) RETURNING id",
      )
      .get({ $name: name, $now: NOW }) as { id: number }
  ).id;
}

function rate(userId: number, workId: number, rating: number, at = NOW): void {
  db.query(
    "INSERT INTO ratings (user_id, work_id, rating, updated_at) VALUES ($u, $w, $r, $at)",
  ).run({ $u: userId, $w: workId, $r: rating, $at: at });
}

function markRead(userId: number, workId: number, finishedAt: string | null): void {
  db.query(
    "INSERT INTO read_states (user_id, work_id, finished_at, updated_at) VALUES ($u, $w, $f, $at)",
  ).run({ $u: userId, $w: workId, $f: finishedAt, $at: NOW });
}

function addSeries(name: string): number {
  return (
    db
      .query(
        "INSERT INTO series (name, match_key, created_at, updated_at) VALUES ($n, $k, $now, $now) RETURNING id",
      )
      .get({ $n: name, $k: matchKey(name), $now: NOW }) as { id: number }
  ).id;
}

function attachSeries(
  workId: number,
  seriesId: number,
  source: string,
  options: { position?: number; primary?: boolean } = {},
): void {
  db.query(
    `INSERT INTO work_series (work_id, series_id, position, source, featured, is_primary, created_at, updated_at)
     VALUES ($w, $s, $p, $source, 0, $primary, $now, $now)`,
  ).run({
    $w: workId,
    $s: seriesId,
    $p: options.position ?? null,
    $source: source,
    $primary: options.primary ? 1 : 0,
    $now: NOW,
  });
}

const ratingOf = (userId: number, workId: number) =>
  (
    db
      .query("SELECT rating FROM ratings WHERE user_id = $u AND work_id = $w")
      .get({ $u: userId, $w: workId }) as { rating: number } | null
  )?.rating ?? null;

const readStateOf = (userId: number, workId: number) =>
  db
    .query("SELECT finished_at FROM read_states WHERE user_id = $u AND work_id = $w")
    .get({ $u: userId, $w: workId }) as { finished_at: string | null } | null;

const seriesOf = (workId: number) =>
  db
    .query(
      "SELECT series_id, source, position, is_primary FROM work_series WHERE work_id = $w ORDER BY series_id, source",
    )
    .all({ $w: workId }) as {
    series_id: number;
    source: string;
    position: number | null;
    is_primary: number;
  }[];

beforeEach(() => {
  db = openDatabase(":memory:");
  works = new WorksStore(db);
});

describe("matchAll", () => {
  test("carries the losing work's rating and read state onto the survivor", () => {
    const reader = addUser("Mike");
    const calibre = addBook({ source: "calibre", title: "The Dispossessed" });
    const hardcover = addBook({ source: "hardcover", title: "The Dispossessed" });

    rate(reader, hardcover.workId, 5);
    markRead(reader, hardcover.workId, "2025-06");

    expect(works.matchAll()).toEqual({ grouped: 1, conflicts: 0 });

    // Oldest wins, and the younger work is gone.
    expect(
      db.query("SELECT COUNT(*) AS n FROM works WHERE id = $w").get({ $w: hardcover.workId }),
    ).toEqual({ n: 0 });
    expect(ratingOf(reader, calibre.workId)).toBe(5);
    expect(readStateOf(reader, calibre.workId)).toEqual({ finished_at: "2025-06" });
  });

  test("carries a manual series attachment and the chosen cover", () => {
    const calibre = addBook({ source: "calibre", title: "A Wizard of Earthsea" });
    const hardcover = addBook({ source: "hardcover", title: "A Wizard of Earthsea" });
    const earthsea = addSeries("Earthsea");

    attachSeries(hardcover.workId, earthsea, "manual", { position: 1, primary: true });
    attachSeries(hardcover.workId, addSeries("Hainish"), "hardcover");
    db.query("UPDATE works SET cover_book_id = $b WHERE id = $w").run({
      $b: hardcover.bookId,
      $w: hardcover.workId,
    });

    works.matchAll();

    // Only the manual attachment comes across — the sync re-derives its own.
    expect(seriesOf(calibre.workId)).toEqual([
      { series_id: earthsea, source: "manual", position: 1, is_primary: 1 },
    ]);
    expect(
      db.query("SELECT cover_book_id FROM works WHERE id = $w").get({ $w: calibre.workId }),
    ).toEqual({ cover_book_id: hardcover.bookId });
  });

  test("keeps the higher rating and the survivor's read state when both sides have one", () => {
    const reader = addUser("Mike");
    const calibre = addBook({ source: "calibre", title: "The Tombs of Atuan" });
    const hardcover = addBook({ source: "hardcover", title: "The Tombs of Atuan" });

    rate(reader, calibre.workId, 3);
    rate(reader, hardcover.workId, 4.5);
    markRead(reader, calibre.workId, "2020");
    markRead(reader, hardcover.workId, "2024");

    works.matchAll();

    expect(ratingOf(reader, calibre.workId)).toBe(4.5);
    expect(readStateOf(reader, calibre.workId)).toEqual({ finished_at: "2020" });
  });

  test("leaves the ratings of a work that keeps a row of its own alone", () => {
    const reader = addUser("Mike");
    const calibre = addBook({ source: "calibre", title: "Malafrena" });
    const hardcover = addBook({ source: "hardcover", title: "Malafrena" });
    // A second row in the hardcover work, matching nothing, so that work stays.
    db.query(
      `INSERT INTO books (source, title, authors, match_key, work_id, added, created_at, updated_at)
       VALUES ('hardcover', 'Orsinian Tales', '["Ursula K. Le Guin"]', 'orsinian tales', $w, $now, $now, $now)`,
    ).run({ $w: hardcover.workId, $now: NOW });

    rate(reader, hardcover.workId, 4);

    works.matchAll();

    expect(ratingOf(reader, hardcover.workId)).toBe(4);
    expect(ratingOf(reader, calibre.workId)).toBeNull();
  });

  test("a rating survives a three-work cluster folding into one", () => {
    const reader = addUser("Mike");
    const calibre = addBook({ source: "calibre", title: "The Farthest Shore" });
    const hardcover = addBook({ source: "hardcover", title: "The Farthest Shore" });
    const opds = addBook({ source: "opds", title: "The Farthest Shore" });

    rate(reader, hardcover.workId, 4);
    markRead(reader, opds.workId, null);

    expect(works.matchAll()).toEqual({ grouped: 2, conflicts: 0 });
    expect(ratingOf(reader, calibre.workId)).toBe(4);
    expect(readStateOf(reader, calibre.workId)).toEqual({ finished_at: null });
  });
});

describe("link", () => {
  test("carries read state, rating and manual series onto the surviving work", () => {
    const reader = addUser("Mike");
    // Different titles, so only a person could put these together.
    const target = addBook({ source: "calibre", title: "Tehanu" });
    const losing = addBook({ source: "hardcover", title: "Tehanu: The Last Book of Earthsea" });
    const earthsea = addSeries("Earthsea");

    rate(reader, losing.workId, 5);
    markRead(reader, losing.workId, "2025-06-15");
    attachSeries(losing.workId, earthsea, "manual", { position: 4 });

    expect(works.link(target.workId, losing.workId)).toBe(target.workId);

    expect(ratingOf(reader, target.workId)).toBe(5);
    expect(readStateOf(reader, target.workId)).toEqual({ finished_at: "2025-06-15" });
    expect(seriesOf(target.workId)).toEqual([
      { series_id: earthsea, source: "manual", position: 4, is_primary: 0 },
    ]);
  });

  test("the survivor's read state stands when both works have one", () => {
    const reader = addUser("Mike");
    const target = addBook({ source: "calibre", title: "The Left Hand of Darkness" });
    const losing = addBook({ source: "hardcover", title: "Left Hand of Darkness" });

    markRead(reader, target.workId, "2019");
    markRead(reader, losing.workId, "2026");

    works.link(target.workId, losing.workId);

    expect(readStateOf(reader, target.workId)).toEqual({ finished_at: "2019" });
    expect(db.query("SELECT COUNT(*) AS n FROM read_states").get()).toEqual({ n: 1 });
  });

  test("a promotion only comes across if the survivor has no primary of its own", () => {
    const target = addBook({ source: "calibre", title: "City of Illusions" });
    const losing = addBook({ source: "hardcover", title: "City of Illusion" });
    const hainish = addSeries("Hainish Cycle");
    const ekumen = addSeries("Ekumen");

    attachSeries(target.workId, hainish, "manual", { primary: true });
    attachSeries(losing.workId, ekumen, "manual", { primary: true });

    works.link(target.workId, losing.workId);

    expect(seriesOf(target.workId)).toEqual([
      { series_id: hainish, source: "manual", position: null, is_primary: 1 },
      { series_id: ekumen, source: "manual", position: null, is_primary: 0 },
    ]);
  });
});
