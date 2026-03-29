import type { Command } from "commander";
import { appendLog, appendComment } from "@grimoire-ai/core";
import { printResult, printError } from "../output.ts";
import * as c from "../colors.ts";

export function registerLogCommand(program: Command): void {
  program
    .command("log <id> <message>")
    .description("Append a changelog entry to a document")
    .option("--author <name>", "Author name (default: agent)")
    .option("--comment", "Mark as comment (appends to Comments section)")
    .action(async (id: string, message: string, opts: { author?: string; comment?: boolean }) => {
      const globalOpts = program.opts<{ cwd?: string }>();

      try {
        const fn = opts.comment ? appendComment : appendLog;
        const result = await fn({
          id,
          message,
          author: opts.author ?? "agent",
          cwd: globalOpts.cwd,
        });

        printResult({ success: true, ...result }, (data) => {
          const d = data as Record<string, unknown>;
          const section = d.section === "comments" ? "Commented on" : "Logged to";
          return `${c.success(section)} ${c.id(String(d.id))} ${c.dim(`(${String(d.date)} | ${String(d.author)})`)}`;
        });
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
      }
    });

  program
    .command("comment <id> <message>")
    .description("Append a comment to a document (shorthand for log --comment)")
    .option("--author <name>", "Author name (default: agent)")
    .action(async (id: string, message: string, opts: { author?: string }) => {
      const globalOpts = program.opts<{ cwd?: string }>();

      try {
        const result = await appendComment({
          id,
          message,
          author: opts.author ?? "agent",
          cwd: globalOpts.cwd,
        });

        printResult({ success: true, ...result }, (data) => {
          const d = data as Record<string, unknown>;
          return `${c.success("Commented on")} ${c.id(String(d.id))} ${c.dim(`(${String(d.date)} | ${String(d.author)})`)}`;
        });
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
      }
    });
}
