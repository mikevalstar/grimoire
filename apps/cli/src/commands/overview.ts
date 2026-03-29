import type { Command } from "commander";
import { overview } from "@grimoire-ai/core";
import { printResult, printError } from "../output.ts";
import * as c from "../colors.ts";

function asText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return undefined;
}

export function registerOverviewCommand(program: Command): void {
  program
    .command("overview")
    .description("Read and display the project overview document")
    .option("--compact", "Summary only (no changelog or full body)")
    .action(async (opts: { compact?: boolean }) => {
      const globalOpts = program.opts<{ cwd?: string }>();

      try {
        const result = await overview({
          compact: opts.compact,
          cwd: globalOpts.cwd,
        });

        printResult(result, (data) => {
          const d = data as Record<string, unknown>;
          const lines: string[] = [];
          const title = asText(d.title);
          const description = asText(d.description);
          const body = asText(d.body);
          if (title) lines.push(c.bold(`# ${title}`));
          if (description) lines.push(description);
          if (body) lines.push("", body);
          return lines.join("\n");
        });
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
      }
    });
}
