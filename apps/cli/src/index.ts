#!/usr/bin/env node
import { Command } from "commander";
import { VERSION } from "@grimoire-ai/core";
import { registerInitCommand } from "./commands/init.ts";
import { registerOverviewCommand } from "./commands/overview.ts";
import { registerDocumentCommands } from "./commands/document.ts";

const program = new Command();

program
  .name("grimoire")
  .description("Grimoire AI — local-first, AI-native requirements management")
  .version(VERSION)
  .option("--cwd <path>", "Target directory (defaults to current working directory)");

registerInitCommand(program);
registerOverviewCommand(program);
registerDocumentCommands(program);

program.parse();
