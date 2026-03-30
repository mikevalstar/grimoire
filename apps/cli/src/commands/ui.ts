import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import { loadConfig } from "@grimoire-ai/core";
import { startServer } from "@grimoire-ai/server";

export function registerUiCommand(program: Command): void {
  program
    .command("ui")
    .description("Launch Grimoire web UI in browser")
    .option("--port <port>", "Port to listen on")
    .option("--no-open", "Do not auto-open browser")
    .action(async (opts: { port?: string; open: boolean }) => {
      const globalOpts = program.opts<{ cwd?: string }>();
      const cwd = globalOpts.cwd ?? process.cwd();
      const config = await loadConfig(cwd);

      const port = opts.port ? Number.parseInt(opts.port, 10) : config.ui.port;
      const autoOpen = opts.open && config.ui.auto_open;

      // Resolve the website dist directory bundled alongside this CLI package
      const cliDir = dirname(fileURLToPath(import.meta.url));
      const staticDir = resolve(cliDir, "../website/dist");

      const { address } = await startServer({ cwd, port, staticDir });

      console.log(`Grimoire UI running at ${address}`);

      if (autoOpen) {
        const open = await import("open");
        await open.default(address);
      }
    });
}
