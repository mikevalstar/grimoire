import type { Command } from "commander";
import { status, type StatusResponse } from "@grimoire-ai/core";
import { printResult, printError } from "../output.ts";
import * as c from "../colors.ts";

function formatStatusResult(data: unknown): string {
  const r = data as StatusResponse;
  const lines: string[] = [];

  // Header
  lines.push(c.bold("Project Status"));
  lines.push("");

  // Document counts
  lines.push(c.bold("Documents"));
  lines.push(
    `  Features: ${r.counts.features}  Requirements: ${r.counts.requirements}  Tasks: ${r.counts.tasks}  Decisions: ${r.counts.decisions}`,
  );
  lines.push(c.dim(`  Total: ${r.counts.total}`));
  lines.push("");

  // Status breakdown
  for (const [type, statuses] of Object.entries(r.by_status)) {
    const parts = Object.entries(statuses)
      .map(([st, cnt]) => `${c.status(st)}: ${cnt}`)
      .join("  ");
    lines.push(`  ${c.bold(type)}: ${parts}`);
  }
  lines.push("");

  // Task health
  lines.push(c.bold("Task Health"));
  lines.push(`  Open tasks: ${r.open_tasks}`);
  if (r.blocked_tasks > 0) {
    lines.push(`  ${c.error(`Blocked tasks: ${r.blocked_tasks}`)}`);
  }
  lines.push("");

  // Health indicators
  lines.push(c.bold("Health"));
  if (r.orphaned_documents > 0) {
    lines.push(c.warn(`  Orphaned documents: ${r.orphaned_documents}`));
  } else {
    lines.push(c.success("  No orphaned documents"));
  }
  if (r.stale_documents > 0) {
    lines.push(c.warn(`  Stale documents (>${r.stale_threshold_days}d): ${r.stale_documents}`));
  } else {
    lines.push(c.success(`  No stale documents (>${r.stale_threshold_days}d)`));
  }
  lines.push("");

  // Recent updates
  if (r.recent.length > 0) {
    lines.push(c.bold("Recent Updates"));
    for (const doc of r.recent) {
      const tp = c.dim(`[${doc.type}]`);
      const dt = c.dim(doc.updated);
      lines.push(`  ${dt} ${tp} ${c.id(doc.id)} ${doc.title} ${c.status(doc.status)}`);
    }
  }

  return lines.join("\n");
}

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show project-wide status dashboard")
    .option("--limit <n>", "Number of recent documents to show (default: 10)", "10")
    .option("--stale-days <n>", "Days before a document is considered stale (default: 30)", "30")
    .action(async (opts: { limit?: string; staleDays?: string }) => {
      const globalOpts = program.opts<{ cwd?: string }>();

      try {
        const result = await status({
          limit: opts.limit ? Number.parseInt(opts.limit, 10) : 10,
          staleDays: opts.staleDays ? Number.parseInt(opts.staleDays, 10) : 30,
          cwd: globalOpts.cwd,
        });

        printResult(result, formatStatusResult);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
      }
    });
}
