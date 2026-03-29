#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("grimoire")
  .description("Grimoire AI — local-first, AI-native requirements management")
  .version("0.0.1");

program
  .command("init")
  .description("Initialize .grimoire/ in current directory")
  .action(() => {
    console.log("Hello from Grimoire AI! 🧙");
    console.log("grimoire init is not yet implemented.");
  });

program.parse();
