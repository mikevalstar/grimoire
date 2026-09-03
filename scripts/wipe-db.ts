#!/usr/bin/env bun
/**
 * Delete grimoire.db so the next launch is a genuine first run — the setup
 * wizard, an empty reader list, no preferences. Calibre is never touched: it
 * lives somewhere else entirely and we only ever read it.
 *
 * Honours $GRIMOIRE_DATA_DIR, so pointing that at a temp dir lets you test
 * setup without going near your real database.
 */
import { existsSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { defaultDatabasePath } from "@grimoire/core";

const dbPath = defaultDatabasePath();
// Uploaded originals (ADR 0021). Deliberately left alone: nothing can rebuild
// them, so removing them is a decision for a person with `rm`, not a script
// whose job is a fresh first run.
const booksDir = join(dirname(dbPath), "books");
// WAL mode leaves two sidecars next to the database; a stale -wal would restore
// rows we just deleted.
const paths = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`];

const removed = paths.filter((path) => {
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
});

if (removed.length === 0) {
  console.log(`Nothing to wipe — no database at ${dbPath}`);
} else {
  for (const path of removed) console.log(`Removed ${path}`);
  console.log("Next launch will run first-time setup.");
  if (existsSync(booksDir)) {
    console.log(
      `Uploaded book files were left in ${booksDir}. The new database won't know about them; delete the directory yourself if you want a clean slate.`,
    );
  }
}
