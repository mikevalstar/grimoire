import type { Command } from "commander";
import { orphans, type OrphansResponse } from "@grimoire-ai/core";
import { printResult, printError } from "../output.ts";
import * as c from "../colors.ts";

function formatOrphansResult(data: unknown): string {
  const result = data as OrphansResponse;
  const lines: string[] = [];

  if (result.count === 0) {
    lines.push(c.success("No orphaned documents found."));
    return lines.join("\n");
  }

  lines.push(c.warn(`Found ${result.count} orphaned document${result.count !== 1 ? "s" : ""}:`));
  lines.push("");

  for (const orphan of result.orphans) {
    const st = orphan.status ? ` ${c.status(orphan.status)}` : "";
    const tp = c.dim(`[${orphan.type}]`);
    lines.push(`  ${tp} ${c.id(orphan.id)} ${orphan.title}${st}`);
  }

  return lines.join("\n");
}

export function registerOrphansCommand(program: Command): void {
  program
    .command("orphans")
    .description("Find documents with no relationships to any other document")
    .option("--type <type>", "Filter by document type: feature, requirement, task, decision")
    .action(async (opts: { type?: string }) => {
      const globalOpts = program.opts<{ cwd?: string }>();

      try {
        const result = await orphans({
          type: (opts.type as "feature" | "requirement" | "task" | "decision") ?? "all",
          cwd: globalOpts.cwd,
        });

        printResult(result, formatOrphansResult);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
      }
    });
}
