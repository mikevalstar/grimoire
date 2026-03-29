#!/usr/bin/env node
import { Command } from "commander";
import { VERSION } from "@grimoire-ai/core";
import { setFormat, type OutputFormat } from "./output.ts";
import { registerInitCommand } from "./commands/init.ts";
import { registerOverviewCommand } from "./commands/overview.ts";
import { registerDocumentCommands } from "./commands/document.ts";
import { registerLogCommand } from "./commands/log.ts";

const program = new Command();

program
  .name("grimoire")
  .description("Grimoire AI — local-first, AI-native requirements management")
  .version(VERSION)
  .option("--cwd <path>", "Target directory (defaults to current working directory)")
  .option("--format <format>", "Output format: json, cli, or auto (default: auto)", "auto")
  .hook("preAction", () => {
    const opts = program.opts<{ format: OutputFormat }>();
    setFormat(opts.format);
  });

registerInitCommand(program);
registerOverviewCommand(program);
registerDocumentCommands(program);
registerLogCommand(program);

program.parse();
