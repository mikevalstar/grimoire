#!/usr/bin/env node
import { Command } from "commander";
import { VERSION } from "@grimoire-ai/core";

const program = new Command();

program
  .name("grimoire")
  .description("Grimoire AI — local-first, AI-native requirements management")
  .version(VERSION);

program
  .command("init")
  .description("Initialize .grimoire/ in current directory")
  .action(() => {
    console.log(JSON.stringify({ message: "grimoire init is not yet implemented." }));
  });

program.parse();
