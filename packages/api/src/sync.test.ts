import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, PREF_KEYS, SettingsStore, WorksStore } from "@grimoire/core";
import { CalibreSync, SyncError } from "./sync.ts";

/**
 * The Calibre sync against a stand-in content server: `fetch` answers the two
 * `/ajax` calls from an in-memory library and 404s every cover, which is what
 * a coverless book does for real.
 */

const BASE = "http://calibre.test";

interface FakeBook {
  uuid: string;
  title: string;
  last_modified: string;
}

let library: Map<number, FakeBook>;
let db: Database;
let dataDir: string;
let sync: CalibreSync;

const realFetch = globalThis.fetch;

beforeEach(() => {
  library = new Map([
    [1, { uuid: "uuid-1", title: "The Dispossessed", last_modified: "2026-01-01T00:00:00Z" }],
    [2, { uuid: "uuid-2", title: "The Lathe of Heaven", last_modified: "2026-01-02T00:00:00Z" }],
  ]);

  globalThis.fetch = Object.assign(
    async (input: string | URL | Request): Promise<Response> => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname === "/ajax/search") {
        return Response.json({
          book_ids: [...library.keys()],
          total_num: library.size,
          num: library.size,
          offset: 0,
          library_id: "test",
        });
      }
      if (url.pathname === "/ajax/books") {
        const ids = (url.searchParams.get("ids") ?? "").split(",").map(Number);
        const body: Record<string, FakeBook | null> = {};
        for (const id of ids) body[String(id)] = library.get(id) ?? null;
        return Response.json(body);
      }
      return new Response("", { status: 404 });
    },
    { preconnect: realFetch.preconnect },
  );

  db = openDatabase(":memory:");
  dataDir = mkdtempSync(join(tmpdir(), "grimoire-sync-"));
  new SettingsStore(db).set(PREF_KEYS.calibreServerUrl, BASE);
  sync = new CalibreSync({ db, calibreServerUrl: () => BASE, dataDir });
});

afterEach(() => {
  globalThis.fetch = realFetch;
  db.close();
  rmSync(dataDir, { recursive: true, force: true });
});

function linkedRows(): { id: number; work_id: number; updated_at: string }[] {
  return db
    .query("SELECT id, work_id, updated_at FROM books WHERE calibre_id IS NOT NULL ORDER BY id")
    .all() as { id: number; work_id: number; updated_at: string }[];
}

test("an empty id list against a populated mirror fails the sync and unlinks nothing", async () => {
  await sync.syncNow();
  expect(linkedRows()).toHaveLength(2);

  library.clear();
  await expect(sync.syncNow()).rejects.toBeInstanceOf(SyncError);

  expect(linkedRows()).toHaveLength(2);
  expect(sync.status().lastStatus).toBe("error");
  expect(sync.status().lastError).toContain("no books");
});

test("an unchanged library skips reconcile after two of its rows merged into one work", async () => {
  await sync.syncNow();
  const [first, second] = linkedRows();
  if (!first || !second) throw new Error("expected two linked rows");
  expect(new WorksStore(db).link(first.work_id, second.work_id)).not.toBeNull();

  // A later `now`, so a reconcile that did run would show as a moved stamp.
  await Bun.sleep(2);
  await sync.syncNow();

  expect(linkedRows().map((row) => row.updated_at)).toEqual([first.updated_at, second.updated_at]);
});
