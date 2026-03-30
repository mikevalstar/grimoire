import type { Command } from "commander";
import { search } from "@grimoire-ai/core";
import { printResult, printError } from "../output.ts";
import * as c from "../colors.ts";

export function registerSearchCommand(program: Command): void {
  program
    .command("search <query>")
    .description("Search documents using hybrid keyword + semantic search")
    .option("--type <type>", "Filter by document type (feature|requirement|task|decision)")
    .option("--status <status>", "Filter by status")
    .option("--tag <tag>", "Filter by tag")
    .option("--limit <n>", "Max results (default: 20)", Number.parseInt)
    .option("--keyword-only", "Use keyword (BM25) search only")
    .option("--semantic-only", "Use semantic (vector) search only")
    .action(
      async (
        query: string,
        opts: {
          type?: string;
          status?: string;
          tag?: string;
          limit?: number;
          keywordOnly?: boolean;
          semanticOnly?: boolean;
        },
      ) => {
        const globalOpts = program.opts<{ cwd?: string }>();

        let mode: "hybrid" | "keyword" | "semantic" = "hybrid";
        if (opts.keywordOnly) mode = "keyword";
        else if (opts.semanticOnly) mode = "semantic";

        try {
          const result = await search({
            query,
            type: (opts.type as "feature" | "requirement" | "task" | "decision" | "all") ?? "all",
            status: opts.status,
            tag: opts.tag,
            limit: opts.limit,
            mode,
            cwd: globalOpts.cwd,
          });

          printResult(result, formatSearchResults);
        } catch (err) {
          printError(err instanceof Error ? err.message : String(err));
        }
      },
    );
}

function formatSearchResults(data: unknown): string {
  const d = data as {
    query: string;
    mode: string;
    results: Array<Record<string, unknown>>;
    count: number;
  };

  if (d.results.length === 0) {
    return c.dim(`No results for "${d.query}"`);
  }

  const modeLabel = d.mode !== "hybrid" ? ` (${d.mode})` : "";
  const header =
    c.dim(`${d.count} result${d.count !== 1 ? "s" : ""} for "${d.query}"${modeLabel}`) + "\n";

  const lines = d.results.map((item) => {
    const parts = [c.id(String(item.id))];
    const type = String(item.type);
    const title = String(item.title);
    const status = String(item.status);
    const score = Number(item.score).toFixed(4);
    const snippet = String(item.snippet);

    parts.push(` ${c.dim(`[${type}]`)}`);
    parts.push(` ${title}`);
    if (status) parts.push(` [${c.status(status)}]`);
    parts.push(` ${c.dim(`(${score})`)}`);
    parts.push(`\n  ${c.dim(snippet.slice(0, 120))}`);
    return parts.join("");
  });

  return header + lines.join("\n");
}
