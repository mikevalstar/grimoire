import type { Command } from "commander";
import { overview, updateOverview } from "@grimoire-ai/core";
import { printResult, printError } from "../output.ts";
import * as c from "../colors.ts";

function asText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return undefined;
}

function collectRepeatable(value: string, previous: string[]): string[] {
  return [...previous, value];
}

export function registerOverviewCommand(program: Command): void {
  const cmd = program
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

  cmd
    .command("update")
    .description("Update the project overview document")
    .option("--title <title>", "Update title")
    .option("--description <desc>", "Update description")
    .option("--add-tag <tag>", "Add a tag (repeatable)", collectRepeatable, [])
    .option("--remove-tag <tag>", "Remove a tag (repeatable)", collectRepeatable, [])
    .option("--body <text>", "Replace body")
    .option("--append <text>", "Append to body")
    .action(
      async (opts: {
        title?: string;
        description?: string;
        addTag: string[];
        removeTag: string[];
        body?: string;
        append?: string;
      }) => {
        const globalOpts = program.opts<{ cwd?: string }>();

        try {
          const result = await updateOverview({
            title: opts.title,
            description: opts.description,
            addTag: opts.addTag,
            removeTag: opts.removeTag,
            body: opts.body,
            append: opts.append,
            cwd: globalOpts.cwd,
          });

          printResult({ success: true, ...result }, (data) => {
            const d = data as Record<string, unknown>;
            const fields = d.updated_fields as string[];
            return `Overview updated: ${fields.join(", ")}`;
          });
        } catch (err) {
          printError(err instanceof Error ? err.message : String(err));
        }
      },
    );
}
