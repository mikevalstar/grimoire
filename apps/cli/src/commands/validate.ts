import type { Command } from "commander";
import { validate, type ValidateResult } from "@grimoire-ai/core";
import { printResult, printError } from "../output.ts";
import * as c from "../colors.ts";

function formatValidateResult(data: unknown): string {
  const result = data as ValidateResult;
  const lines: string[] = [];

  if (result.valid && result.warnings === 0) {
    lines.push(c.success("Validation passed — no issues found."));
    return lines.join("\n");
  }

  const parts: string[] = [];
  if (result.errors > 0)
    parts.push(c.error(`${result.errors} error${result.errors !== 1 ? "s" : ""}`));
  if (result.warnings > 0)
    parts.push(c.warn(`${result.warnings} warning${result.warnings !== 1 ? "s" : ""}`));
  lines.push(`Validation: ${parts.join(", ")}`);
  lines.push("");

  for (const issue of result.issues) {
    const severity = issue.severity === "error" ? c.error("ERROR") : c.warn("WARN ");
    const tag = c.dim(`[${issue.type}]`);
    const doc = issue.document ? c.id(issue.document) + " — " : "";
    lines.push(`  ${severity} ${tag} ${doc}${issue.message}`);
  }

  return lines.join("\n");
}

export function registerValidateCommand(program: Command): void {
  program
    .command("validate")
    .description(
      "Check for broken links, missing required fields, orphaned documents, and schema issues",
    )
    .action(async () => {
      const globalOpts = program.opts<{ cwd?: string }>();

      try {
        const result = await validate({ cwd: globalOpts.cwd });

        if (!result.valid) {
          process.exitCode = 1;
        }

        printResult(result, formatValidateResult);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
      }
    });
}
