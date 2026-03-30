/**
 * Auto-sync — transparently trigger an incremental sync before
 * database-reading commands when markdown files have changed.
 *
 * Uses file mtime comparison against the stored last_sync_at timestamp
 * for fast change detection (<100ms when no files changed).
 */

import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { getDatabase } from "./database.ts";
import { loadConfig } from "./config.ts";
import { sync, loadSyncTimestamp } from "./sync.ts";
import type { SyncResult } from "./sync.ts";

const GRIMOIRE_DIR = ".grimoire";
const SCAN_DIRS = ["features", "requirements", "tasks", "decisions"];

export interface AutoSyncResult {
  /** Whether auto-sync is enabled in config. */
  enabled: boolean;
  /** Whether a sync was needed and executed. */
  synced: boolean;
  /** The sync result, if a sync was performed. */
  result?: SyncResult;
  /** Warning messages (sync errors are non-fatal in auto-sync). */
  warnings: string[];
}

/**
 * Check whether any markdown file has been modified since the last sync.
 * Uses file mtime for fast O(n) stat-only detection.
 */
async function hasChangedFiles(grimoireDir: string, lastSyncAt: Date): Promise<boolean> {
  const lastSyncMs = lastSyncAt.getTime();

  // Check the root directory itself so overview.md creation/deletion and
  // subdirectory churn can trigger a sync even when no file mtime changed yet.
  try {
    const s = await stat(grimoireDir);
    if (s.mtimeMs > lastSyncMs) return true;
  } catch {
    return true;
  }

  // Check overview.md
  try {
    const s = await stat(join(grimoireDir, "overview.md"));
    if (s.mtimeMs > lastSyncMs) return true;
  } catch {
    // File missing is a change (deleted)
    return true;
  }

  // Check subdirectories
  for (const dirName of SCAN_DIRS) {
    const dirPath = join(grimoireDir, dirName);
    try {
      const dirStat = await stat(dirPath);
      if (dirStat.mtimeMs > lastSyncMs) return true;
    } catch {
      return true;
    }

    let entries: import("node:fs").Dirent[];
    entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        const s = await stat(join(dirPath, entry.name));
        if (s.mtimeMs > lastSyncMs) return true;
      }
    }
  }

  return false;
}

/**
 * Automatically run an incremental sync if markdown files have changed
 * since the last sync. Respects the `sync.auto_sync` config setting.
 *
 * Sync errors are captured as warnings rather than thrown, so the
 * calling command can still proceed.
 */
export async function autoSync(cwd: string = process.cwd()): Promise<AutoSyncResult> {
  const config = await loadConfig(cwd);

  if (!config.sync.auto_sync) {
    return { enabled: false, synced: false, warnings: [] };
  }

  const grimoireDir = join(cwd, GRIMOIRE_DIR);
  const warnings: string[] = [];

  try {
    const connection = await getDatabase(cwd);
    const lastSyncAt = await loadSyncTimestamp(connection);

    // No prior sync — need a full sync
    if (!lastSyncAt) {
      const result = await sync({ cwd, skipEmbeddings: true });
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          warnings.push(`${err.file}: ${err.message}`);
        }
      }
      return { enabled: true, synced: true, result, warnings };
    }

    // Check if any files changed since last sync
    const changed = await hasChangedFiles(grimoireDir, lastSyncAt);
    if (!changed) {
      return { enabled: true, synced: false, warnings: [] };
    }

    // Run incremental sync
    const result = await sync({ cwd, skipEmbeddings: true });
    if (result.errors.length > 0) {
      for (const err of result.errors) {
        warnings.push(`${err.file}: ${err.message}`);
      }
    }
    return { enabled: true, synced: true, result, warnings };
  } catch (err) {
    warnings.push(`Auto-sync failed: ${err instanceof Error ? err.message : String(err)}`);
    return { enabled: true, synced: false, warnings };
  }
}
