import type { Command } from "commander";
import { sync, type SyncResult } from "@grimoire-ai/core";
import { printResult, printError } from "../output.ts";
import * as c from "../colors.ts";

function formatSyncResult(data: unknown): string {
  const result = data as SyncResult;
  const lines: string[] = [];

  if (result.dry_run) {
    const mode = result.incremental ? "Incremental sync" : "Full sync";
    lines.push(c.warn(`Dry run (${mode}) — no changes written.`));
    lines.push("");

    const changes = result.changes ?? [];
    const added = changes.filter((ch) => ch.action === "add");
    const updated = changes.filter((ch) => ch.action === "update");
    const removed = changes.filter((ch) => ch.action === "remove");

    if (changes.length === 0) {
      lines.push(c.dim("No changes detected."));
    } else {
      if (added.length > 0) {
        lines.push(c.success(`Add (${added.length}):`));
        for (const ch of added) lines.push(`  ${c.success("+")} ${ch.filepath}`);
      }
      if (updated.length > 0) {
        lines.push(c.warn(`Update (${updated.length}):`));
        for (const ch of updated) lines.push(`  ${c.warn("~")} ${ch.filepath}`);
      }
      if (removed.length > 0) {
        lines.push(c.error(`Remove (${removed.length}):`));
        for (const ch of removed) lines.push(`  ${c.error("-")} ${ch.filepath}`);
      }
    }
  } else {
    const mode = result.incremental ? "Incremental sync" : "Full sync";
    lines.push(c.success(`${mode} complete.`));
    lines.push("");
    lines.push(c.label("Files processed:", String(result.files_processed)));
    lines.push(c.label("Documents synced:", String(result.documents_synced)));
    lines.push(c.label("Relationships synced:", String(result.relationships_synced)));
    lines.push(c.label("Changelog entries:", String(result.changelog_entries_synced)));
  }

  if (result.errors.length > 0) {
    lines.push("");
    lines.push(c.warn(`${result.errors.length} error${result.errors.length !== 1 ? "s" : ""}:`));
    for (const err of result.errors) {
      lines.push(`  ${c.error("•")} ${c.dim(err.file)} — ${err.message}`);
    }
  }

  return lines.join("\n");
}

export function registerSyncCommand(program: Command): void {
  program
    .command("sync")
    .description("Sync DuckDB database from markdown files")
    .option("--full", "Force a full rebuild instead of incremental sync")
    .option("--force", "Force a full rebuild (alias for --full)")
    .option("--dry-run", "Report what would change without writing to the database")
    .action(async (opts: { full?: boolean; force?: boolean; dryRun?: boolean }) => {
      const globalOpts = program.opts<{ cwd?: string }>();

      try {
        const result = await sync({
          cwd: globalOpts.cwd,
          full: opts.full || opts.force,
          dryRun: opts.dryRun,
        });
        printResult(result, formatSyncResult);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
      }
    });
}
