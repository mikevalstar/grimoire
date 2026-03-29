import type { Command } from "commander";
import { init, initOptionsSchema } from "@grimoire-ai/core";

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
        console.error(
          JSON.stringify({
            error: `Invalid options: missing ${missing}`,
            hint: 'Usage: grimoire init --name "My Project"',
          }),
        );
        process.exitCode = 1;
        return;
      }

      try {
        const result = await init(parsed.data);

        console.log(
          JSON.stringify({
            success: true,
            grimoire_dir: result.grimoireDir,
            created: result.created,
            gitignore_updated: result.gitignoreUpdated,
            agents_file_updated: result.agentsFileUpdated,
            agents_file: result.agentsFilePath,
            warnings: result.warnings,
          }),
        );
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
