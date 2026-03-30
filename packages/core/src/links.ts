/**
 * Links — query relationships for a document with direction, type, and depth filtering.
 * Uses the `relationships` table populated by sync.
 */

import { z } from "zod";
import { getDatabase } from "./database.ts";
import { autoSync } from "./auto-sync.ts";

export interface LinkItem {
  id: string;
  title: string;
  type: string;
  status: string;
  relationship: string;
  direction: "in" | "out";
  depth: number;
}

export interface LinksResponse {
  id: string;
  links: LinkItem[];
  count: number;
}

const linksOptionsSchema = z.object({
  id: z.string().min(1),
  direction: z.enum(["in", "out", "both"]).default("both"),
  type: z.string().optional(),
  depth: z.number().int().min(1).max(5).default(1),
  cwd: z.string().optional(),
});

export type LinksOptions = z.input<typeof linksOptionsSchema>;

/** Escape a string for SQL single-quoted literals. */
function esc(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Query all relationships for a given document.
 * Supports direction filtering, relationship type filtering, and depth traversal.
 */
export async function links(options: LinksOptions): Promise<LinksResponse> {
  const opts = linksOptionsSchema.parse(options);
  const cwd = opts.cwd ?? process.cwd();

  await autoSync(cwd);

  const connection = await getDatabase(cwd);

  // Verify document exists
  const docResult = await connection.runAndReadAll(
    `SELECT id FROM documents WHERE id = '${esc(opts.id)}'`,
  );
  if (docResult.getRows().length === 0) {
    throw new Error(`Document not found: ${opts.id}`);
  }

  // BFS traversal for depth > 1
  const visited = new Set<string>();
  const allLinks: LinkItem[] = [];
  let frontier = [opts.id];

  for (let currentDepth = 1; currentDepth <= opts.depth; currentDepth++) {
    if (frontier.length === 0) break;

    const nextFrontier: string[] = [];

    for (const nodeId of frontier) {
      const items = await queryDirectLinks(connection, nodeId, opts.direction, opts.type);

      for (const item of items) {
        // Don't include the root document or already-visited nodes
        if (item.id === opts.id || visited.has(item.id)) continue;
        visited.add(item.id);

        allLinks.push({ ...item, depth: currentDepth });
        nextFrontier.push(item.id);
      }
    }

    frontier = nextFrontier;
  }

  return {
    id: opts.id,
    links: allLinks,
    count: allLinks.length,
  };
}

/** Query direct (depth-1) links for a single node. */
async function queryDirectLinks(
  connection: Awaited<ReturnType<typeof getDatabase>>,
  nodeId: string,
  direction: "in" | "out" | "both",
  relType?: string,
): Promise<Omit<LinkItem, "depth">[]> {
  const items: Omit<LinkItem, "depth">[] = [];

  // Outbound: this node is the source
  if (direction === "out" || direction === "both") {
    const conditions = [`r.source_id = '${esc(nodeId)}'`];
    if (relType) conditions.push(`r.relationship = '${esc(relType)}'`);

    const sql = `
      SELECT d.id, d.title, d.type, d.status, r.relationship
      FROM relationships r
      JOIN documents d ON d.id = r.target_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY d.type, d.title
    `;
    const result = await connection.runAndReadAll(sql);
    for (const row of result.getRows()) {
      items.push({
        id: row[0] as string,
        title: row[1] as string,
        type: row[2] as string,
        status: (row[3] as string) ?? "",
        relationship: row[4] as string,
        direction: "out",
      });
    }
  }

  // Inbound: this node is the target
  if (direction === "in" || direction === "both") {
    const conditions = [`r.target_id = '${esc(nodeId)}'`];
    if (relType) conditions.push(`r.relationship = '${esc(relType)}'`);

    const sql = `
      SELECT d.id, d.title, d.type, d.status, r.relationship
      FROM relationships r
      JOIN documents d ON d.id = r.source_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY d.type, d.title
    `;
    const result = await connection.runAndReadAll(sql);
    for (const row of result.getRows()) {
      items.push({
        id: row[0] as string,
        title: row[1] as string,
        type: row[2] as string,
        status: (row[3] as string) ?? "",
        relationship: row[4] as string,
        direction: "in",
      });
    }
  }

  return items;
}
