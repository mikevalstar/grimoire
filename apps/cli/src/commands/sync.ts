import type { Command } from "commander";
import { sync, type SyncResult } from "@grimoire-ai/core";
import { printResult, printError } from "../output.ts";
import * as c from "../colors.ts";

function formatSyncResult(data: unknown): string {
  const result = data as SyncResult;
  const lines: string[] = [];

  const mode = result.incremental ? "Incremental sync" : "Full sync";
  lines.push(c.success(`${mode} complete.`));
  lines.push("");
  lines.push(c.label("Files processed:", String(result.files_processed)));
  lines.push(c.label("Documents synced:", String(result.documents_synced)));
  lines.push(c.label("Relationships synced:", String(result.relationships_synced)));
  lines.push(c.label("Changelog entries:", String(result.changelog_entries_synced)));

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
    .action(async (opts: { full?: boolean }) => {
      const globalOpts = program.opts<{ cwd?: string }>();

      try {
        const result = await sync({ cwd: globalOpts.cwd, full: opts.full });
        printResult(result, formatSyncResult);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
      }
    });
}
