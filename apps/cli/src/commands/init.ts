import type { Command } from "commander";
import { init, initOptionsSchema } from "@grimoire-ai/core";
import { printResult, printError } from "../output.ts";
import * as c from "../colors.ts";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize .grimoire/ in current directory")
    .option("--name <name>", "Project name")
    .option("--description <desc>", "Project description")
    .option("--skip-skills", "Don't copy skill files")
    .action(async (opts: { name?: string; description?: string; skipSkills?: boolean }) => {
      const globalOpts = program.opts<{ cwd?: string }>();

      const parsed = initOptionsSchema.safeParse({
        ...opts,
        cwd: globalOpts.cwd,
      });

      if (!parsed.success) {
        const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
        printError(
          `Invalid options: missing ${missing}`,
          'Usage: grimoire init --name "My Project"',
        );
        return;
      }

      try {
        const result = await init(parsed.data);

        printResult(
          {
            success: true,
            grimoire_dir: result.grimoireDir,
            created: result.created,
            gitignore_updated: result.gitignoreUpdated,
            agents_file_updated: result.agentsFileUpdated,
            agents_file: result.agentsFilePath,
            warnings: result.warnings,
          },
          (data) => {
            const d = data as typeof result;
            const lines = [`${c.success("Initialized")} grimoire in ${c.bold(d.grimoireDir)}`];
            if (d.created.length > 0) lines.push(`  ${c.dim("Created:")} ${d.created.join(", ")}`);
            if (d.gitignoreUpdated) lines.push(`  ${c.dim("Updated")} .gitignore`);
            if (d.agentsFileUpdated) lines.push(`  ${c.dim("Updated")} ${d.agentsFilePath}`);
            if (d.warnings.length > 0) {
              for (const w of d.warnings) lines.push(`  ${c.warn("Warning:")} ${w}`);
            }
            return lines.join("\n");
          },
        );
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
      }
    });
}
