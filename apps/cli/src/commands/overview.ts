import type { Command } from "commander";
import { overview } from "@grimoire-ai/core";

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

        console.log(JSON.stringify(result));
      } catch (err) {
        console.error(
          JSON.stringify({
            error: err instanceof Error ? err.message : String(err),
          }),
        );
        process.exitCode = 1;
      }
    });
}
