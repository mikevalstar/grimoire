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
import { defaultDatabasePath } from "@grimoire/core";

const dbPath = defaultDatabasePath();
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
}
