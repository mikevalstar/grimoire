import type { Command } from "commander";
import { tree, type TreeNode, type TreeResponse } from "@grimoire-ai/core";
import { printResult, printError } from "../output.ts";
import * as c from "../colors.ts";

function renderNode(node: TreeNode, indent: string, isLast: boolean, collapsed: boolean): string[] {
  const lines: string[] = [];
  const connector = isLast ? "└── " : "├── ";
  const st = node.status ? ` ${c.status(node.status)}` : "";
  lines.push(`${indent}${connector}${c.id(node.id)} ${node.title}${st}`);

  if (!collapsed || node.children.length > 0) {
    const childIndent = indent + (isLast ? "    " : "│   ");
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]!;
      const childIsLast = i === node.children.length - 1;
      lines.push(...renderNode(child, childIndent, childIsLast, collapsed));
    }
  }

  return lines;
}

function formatTreeResult(data: unknown, collapsed: boolean): string {
  const result = data as TreeResponse;
  const lines: string[] = [];

  if (result.count === 0) {
    lines.push(c.dim("No documents found."));
    return lines.join("\n");
  }

  for (let i = 0; i < result.tree.length; i++) {
    const root = result.tree[i]!;
    const isLast = i === result.tree.length - 1;
    const st = root.status ? ` ${c.status(root.status)}` : "";
    lines.push(`${c.id(root.id)} ${c.bold(root.title)}${st}`);

    for (let j = 0; j < root.children.length; j++) {
      const child = root.children[j]!;
      const childIsLast = j === root.children.length - 1;
      lines.push(...renderNode(child, "", childIsLast, collapsed));
    }

    if (!isLast) lines.push("");
  }

  lines.push("");
  lines.push(c.dim(`${result.count} document${result.count !== 1 ? "s" : ""}`));

  return lines.join("\n");
}

export function registerTreeCommand(program: Command): void {
  program
    .command("tree")
    .description("Display the feature → requirement → task hierarchy")
    .option("--feature <feature-id>", "Show tree for a specific feature")
    .option("--status <status>", "Filter nodes by status")
    .option("--collapsed", "Show IDs and titles only")
    .action(async (opts: { feature?: string; status?: string; collapsed?: boolean }) => {
      const globalOpts = program.opts<{ cwd?: string }>();

      try {
        const result = await tree({
          feature: opts.feature,
          status: opts.status,
          cwd: globalOpts.cwd,
        });

        printResult(result, (data) => formatTreeResult(data, opts.collapsed ?? false));
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
      }
    });
}
