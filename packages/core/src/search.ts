/**
 * Full-text keyword search using DuckDB FTS extension with BM25 ranking.
 * Phase 2: keyword-only search. Semantic/hybrid search added in Phase 3.
 */

import { z } from "zod";
import { getDatabase } from "./database.ts";
import { autoSync } from "./auto-sync.ts";

export interface SearchResult {
  id: string;
  title: string;
  type: string;
  status: string;
  score: number;
  snippet: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  count: number;
}

const searchOptionsSchema = z.object({
  query: z.string().min(1),
  type: z.enum(["feature", "requirement", "task", "decision", "all"]).default("all"),
  status: z.string().optional(),
  tag: z.string().optional(),
  limit: z.number().int().positive().default(20),
  cwd: z.string().optional(),
});

export type SearchOptions = z.input<typeof searchOptionsSchema>;

/** Escape a string for SQL single-quoted literals. */
function esc(value: string): string {
  return value.replace(/'/g, "''");
}

/** Extract a snippet from body text around the first occurrence of any query term. */
function extractSnippet(body: string, query: string, maxLen = 200): string {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const lowerBody = body.toLowerCase();

  let bestIndex = -1;
  for (const term of terms) {
    const idx = lowerBody.indexOf(term);
    if (idx !== -1 && (bestIndex === -1 || idx < bestIndex)) {
      bestIndex = idx;
    }
  }

  if (bestIndex === -1) {
    // No term match in body — return the beginning
    return body.length <= maxLen ? body : `${body.slice(0, maxLen)}...`;
  }

  const start = Math.max(0, bestIndex - 60);
  const end = Math.min(body.length, start + maxLen);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < body.length ? "..." : "";
  return `${prefix}${body.slice(start, end)}${suffix}`;
}

/**
 * Search documents using BM25 full-text search.
 * Requires a prior `grimoire sync` to populate the FTS index.
 */
export async function search(options: SearchOptions): Promise<SearchResponse> {
  const opts = searchOptionsSchema.parse(options);
  const cwd = opts.cwd ?? process.cwd();

  // Auto-sync if needed
  await autoSync(cwd);

  const connection = await getDatabase(cwd);

  // Build WHERE clause for filters
  const conditions: string[] = [];

  if (opts.type !== "all") {
    conditions.push(`d.type = '${esc(opts.type)}'`);
  }
  if (opts.status) {
    conditions.push(`d.status = '${esc(opts.status)}'`);
  }
  if (opts.tag) {
    conditions.push(`list_contains(d.tags, '${esc(opts.tag)}')`);
  }

  const whereClause = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT d.id, d.title, d.type, d.status, d.body,
           fts_main_documents.match_bm25(d.id, '${esc(opts.query)}') AS score
    FROM documents d
    WHERE score IS NOT NULL
    ${whereClause}
    ORDER BY score DESC
    LIMIT ${opts.limit}
  `;

  const result = await connection.runAndReadAll(sql);
  const rows = result.getRows();

  const results: SearchResult[] = rows.map((row) => ({
    id: row[0] as string,
    title: row[1] as string,
    type: row[2] as string,
    status: (row[3] as string) ?? "",
    snippet: extractSnippet((row[4] as string) ?? "", opts.query),
    score: row[5] as number,
  }));

  return {
    query: opts.query,
    results,
    count: results.length,
  };
}
