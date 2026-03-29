import type { Command } from "commander";
import { overview } from "@grimoire-ai/core";
import { printResult, printError } from "../output.ts";

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
          if (d.title) lines.push(`# ${String(d.title)}`);
          if (d.description) lines.push(String(d.description));
          if (d.body) lines.push("", String(d.body));
          return lines.join("\n");
        });
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
      }
    });
}
