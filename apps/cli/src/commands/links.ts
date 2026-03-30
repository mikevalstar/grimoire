import type { Command } from "commander";
import { links, type LinksResponse } from "@grimoire-ai/core";
import { printResult, printError } from "../output.ts";
import * as c from "../colors.ts";

const DIRECTION_ARROWS: Record<string, string> = {
  out: "->",
  in: "<-",
};

function formatLinksResult(data: unknown): string {
  const result = data as LinksResponse;
  const lines: string[] = [];

  if (result.count === 0) {
    lines.push(c.dim(`No relationships found for ${c.id(result.id)}`));
    return lines.join("\n");
  }

  lines.push(c.bold(`Links for ${c.id(result.id)}`));
  lines.push("");

  // Group by depth
  const byDepth = new Map<number, typeof result.links>();
  for (const link of result.links) {
    const group = byDepth.get(link.depth) ?? [];
    group.push(link);
    byDepth.set(link.depth, group);
  }

  for (const [depth, depthLinks] of byDepth) {
    if (byDepth.size > 1) {
      lines.push(c.dim(`  Depth ${depth}:`));
    }

    for (const link of depthLinks) {
      const arrow = DIRECTION_ARROWS[link.direction] ?? "--";
      const rel = c.dim(`[${link.relationship}]`);
      const docId = c.id(link.id);
      const title = link.title;
      const st = link.status ? ` ${c.status(link.status)}` : "";
      lines.push(`  ${arrow} ${rel} ${docId} ${title}${st}`);
    }
  }

  lines.push("");
  lines.push(c.dim(`${result.count} relationship${result.count !== 1 ? "s" : ""}`));

  return lines.join("\n");
}

export function registerLinksCommand(program: Command): void {
  program
    .command("links <id>")
    .description("Show all relationships for a document")
    .option("--direction <dir>", "Filter by direction: in, out, or both (default: both)")
    .option("--type <type>", "Filter by relationship type")
    .option("--depth <n>", "Traversal depth 1-5 (default: 1)", "1")
    .action(
      async (
        id: string,
        opts: {
          direction?: string;
          type?: string;
          depth?: string;
        },
      ) => {
        const globalOpts = program.opts<{ cwd?: string }>();

        try {
          const result = await links({
            id,
            direction: (opts.direction as "in" | "out" | "both") ?? "both",
            type: opts.type,
            depth: opts.depth ? Number.parseInt(opts.depth, 10) : 1,
            cwd: globalOpts.cwd,
          });

          printResult(result, formatLinksResult);
        } catch (err) {
          printError(err instanceof Error ? err.message : String(err));
        }
      },
    );
}
