/**
 * Hybrid search combining BM25 full-text search with semantic vector similarity.
 * Supports three modes: hybrid (default), keyword-only, and semantic-only.
 * Gracefully falls back to keyword-only if embeddings are unavailable.
 */

import { z } from "zod";
import { getDatabase, isVssAvailable } from "./database.ts";
import { autoSync } from "./auto-sync.ts";
import { generateEmbedding } from "./embeddings.ts";
import { loadConfig } from "./config.ts";

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
  mode: "hybrid" | "keyword" | "semantic";
  results: SearchResult[];
  count: number;
}

const searchOptionsSchema = z.object({
  query: z.string().min(1),
  type: z.enum(["feature", "requirement", "task", "decision", "all"]).default("all"),
  status: z.string().optional(),
  tag: z.string().optional(),
  limit: z.number().int().positive().default(20),
  mode: z.enum(["hybrid", "keyword", "semantic"]).default("hybrid"),
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
    return body.length <= maxLen ? body : `${body.slice(0, maxLen)}...`;
  }

  const start = Math.max(0, bestIndex - 60);
  const end = Math.min(body.length, start + maxLen);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < body.length ? "..." : "";
  return `${prefix}${body.slice(start, end)}${suffix}`;
}

/** Build WHERE clause fragments for common filters. */
function buildFilterClause(
  opts: { type: string; status?: string; tag?: string },
  alias: string,
): string {
  const conditions: string[] = [];
  if (opts.type !== "all") {
    conditions.push(`${alias}.type = '${esc(opts.type)}'`);
  }
  if (opts.status) {
    conditions.push(`${alias}.status = '${esc(opts.status)}'`);
  }
  if (opts.tag) {
    conditions.push(`list_contains(${alias}.tags, '${esc(opts.tag)}')`);
  }
  return conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";
}

interface ScoredDoc {
  id: string;
  title: string;
  type: string;
  status: string;
  body: string;
  keywordScore: number;
  semanticScore: number;
  combinedScore: number;
}

/**
 * Run BM25 keyword search and return scored results.
 */
async function keywordSearch(
  connection: Awaited<ReturnType<typeof getDatabase>>,
  query: string,
  filterClause: string,
  limit: number,
): Promise<Map<string, ScoredDoc>> {
  const sql = `
    SELECT d.id, d.title, d.type, d.status, d.body,
           fts_main_documents.match_bm25(d.id, '${esc(query)}') AS score
    FROM documents d
    WHERE score IS NOT NULL
    ${filterClause}
    ORDER BY score DESC
    LIMIT ${limit}
  `;

  const result = await connection.runAndReadAll(sql);
  const rows = result.getRows();
  const docs = new Map<string, ScoredDoc>();

  for (const row of rows) {
    const id = row[0] as string;
    docs.set(id, {
      id,
      title: row[1] as string,
      type: row[2] as string,
      status: (row[3] as string) ?? "",
      body: (row[4] as string) ?? "",
      keywordScore: row[5] as number,
      semanticScore: 0,
      combinedScore: 0,
    });
  }

  return docs;
}

/**
 * Run vector similarity search and return scored results.
 * Uses cosine distance via DuckDB array_cosine_distance.
 */
async function semanticSearch(
  connection: Awaited<ReturnType<typeof getDatabase>>,
  queryEmbedding: number[],
  filterClause: string,
  limit: number,
): Promise<Map<string, ScoredDoc>> {
  const vecStr = `[${queryEmbedding.join(",")}]::FLOAT[768]`;

  const sql = `
    SELECT d.id, d.title, d.type, d.status, d.body,
           1 - array_cosine_distance(d.embedding, ${vecStr}) AS score
    FROM documents d
    WHERE d.embedding IS NOT NULL
    ${filterClause}
    ORDER BY score DESC
    LIMIT ${limit}
  `;

  const result = await connection.runAndReadAll(sql);
  const rows = result.getRows();
  const docs = new Map<string, ScoredDoc>();

  for (const row of rows) {
    const id = row[0] as string;
    docs.set(id, {
      id,
      title: row[1] as string,
      type: row[2] as string,
      status: (row[3] as string) ?? "",
      body: (row[4] as string) ?? "",
      keywordScore: 0,
      semanticScore: row[5] as number,
      combinedScore: 0,
    });
  }

  return docs;
}

/**
 * Normalize scores to [0, 1] range using min-max normalization.
 */
function normalizeScores(
  docs: Map<string, ScoredDoc>,
  field: "keywordScore" | "semanticScore",
): void {
  if (docs.size === 0) return;

  let min = Infinity;
  let max = -Infinity;
  for (const doc of docs.values()) {
    const val = doc[field];
    if (val < min) min = val;
    if (val > max) max = val;
  }

  const range = max - min;
  if (range === 0) {
    // All scores are the same — normalize to 1.0
    for (const doc of docs.values()) {
      doc[field] = doc[field] > 0 ? 1.0 : 0;
    }
    return;
  }

  for (const doc of docs.values()) {
    doc[field] = (doc[field] - min) / range;
  }
}

/**
 * Search documents using hybrid BM25 + semantic search.
 * Falls back to keyword-only if embeddings are unavailable.
 */
export async function search(options: SearchOptions): Promise<SearchResponse> {
  const opts = searchOptionsSchema.parse(options);
  const cwd = opts.cwd ?? process.cwd();

  await autoSync(cwd);

  const connection = await getDatabase(cwd);
  const config = await loadConfig(cwd);
  const filterClause = buildFilterClause(opts, "d");

  let effectiveMode = opts.mode;

  // Check if semantic search is possible
  if (effectiveMode !== "keyword") {
    const hasVss = await isVssAvailable(connection);
    if (!hasVss) {
      // Fallback to keyword-only
      effectiveMode = "keyword";
    } else {
      // Check if any embeddings exist
      const result = await connection.runAndReadAll(
        "SELECT COUNT(*) FROM documents WHERE embedding IS NOT NULL",
      );
      const count = result.getRows()[0]?.[0] as number;
      if (count === 0) {
        effectiveMode = "keyword";
      }
    }
  }

  // Keyword-only mode
  if (effectiveMode === "keyword") {
    const keywordDocs = await keywordSearch(connection, opts.query, filterClause, opts.limit);

    const results: SearchResult[] = Array.from(keywordDocs.values()).map((doc) => ({
      id: doc.id,
      title: doc.title,
      type: doc.type,
      status: doc.status,
      score: doc.keywordScore,
      snippet: extractSnippet(doc.body, opts.query),
    }));

    return { query: opts.query, mode: "keyword", results, count: results.length };
  }

  // Generate query embedding for semantic modes
  const queryEmbedding = await generateEmbedding(opts.query, { prefix: "search_query" });

  // Semantic-only mode
  if (effectiveMode === "semantic") {
    const semanticDocs = await semanticSearch(connection, queryEmbedding, filterClause, opts.limit);

    const results: SearchResult[] = Array.from(semanticDocs.values()).map((doc) => ({
      id: doc.id,
      title: doc.title,
      type: doc.type,
      status: doc.status,
      score: doc.semanticScore,
      snippet: extractSnippet(doc.body, opts.query),
    }));

    return { query: opts.query, mode: "semantic", results, count: results.length };
  }

  // Hybrid mode — run both searches and merge
  const [keywordDocs, semanticDocs] = await Promise.all([
    keywordSearch(connection, opts.query, filterClause, opts.limit * 2),
    semanticSearch(connection, queryEmbedding, filterClause, opts.limit * 2),
  ]);

  // Normalize scores independently
  normalizeScores(keywordDocs, "keywordScore");
  normalizeScores(semanticDocs, "semanticScore");

  // Merge results
  const merged = new Map<string, ScoredDoc>();

  for (const [id, doc] of keywordDocs) {
    merged.set(id, { ...doc });
  }

  for (const [id, doc] of semanticDocs) {
    const existing = merged.get(id);
    if (existing) {
      existing.semanticScore = doc.semanticScore;
    } else {
      merged.set(id, { ...doc });
    }
  }

  // Compute combined scores using configured weights
  const kw = config.search.keyword_weight;
  const sw = config.search.semantic_weight;

  for (const doc of merged.values()) {
    doc.combinedScore = kw * doc.keywordScore + sw * doc.semanticScore;
  }

  // Sort by combined score and take top N
  const sorted = Array.from(merged.values())
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, opts.limit);

  const results: SearchResult[] = sorted.map((doc) => ({
    id: doc.id,
    title: doc.title,
    type: doc.type,
    status: doc.status,
    score: doc.combinedScore,
    snippet: extractSnippet(doc.body, opts.query),
  }));

  return { query: opts.query, mode: "hybrid", results, count: results.length };
}
