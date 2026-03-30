/**
 * Orphans — find documents with no relationships to any other document.
 * Uses the `relationships` table to detect unlinked documents.
 */

import { z } from "zod";
import { getDatabase } from "./database.ts";
import { autoSync } from "./auto-sync.ts";

export interface OrphanItem {
  id: string;
  title: string;
  type: string;
  status: string;
  filepath: string;
}

export interface OrphansResponse {
  orphans: OrphanItem[];
  count: number;
}

const orphansOptionsSchema = z.object({
  type: z.enum(["feature", "requirement", "task", "decision", "all"]).default("all"),
  cwd: z.string().optional(),
});

export type OrphansOptions = z.input<typeof orphansOptionsSchema>;

/** Escape a string for SQL single-quoted literals. */
function esc(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Find documents that have no relationships (neither source nor target).
 * The overview document is excluded since it is intentionally standalone.
 */
export async function orphans(options: OrphansOptions = {}): Promise<OrphansResponse> {
  const opts = orphansOptionsSchema.parse(options);
  const cwd = opts.cwd ?? process.cwd();

  await autoSync(cwd);

  const connection = await getDatabase(cwd);

  const conditions = ["d.type != 'overview'"];
  if (opts.type !== "all") {
    conditions.push(`d.type = '${esc(opts.type)}'`);
  }

  const sql = `
    SELECT d.id, d.title, d.type, d.status, d.filepath
    FROM documents d
    WHERE ${conditions.join(" AND ")}
      AND d.id NOT IN (SELECT source_id FROM relationships)
      AND d.id NOT IN (SELECT target_id FROM relationships)
    ORDER BY d.type, d.title
  `;

  const result = await connection.runAndReadAll(sql);
  const items: OrphanItem[] = result.getRows().map((row) => ({
    id: row[0] as string,
    title: row[1] as string,
    type: row[2] as string,
    status: (row[3] as string) ?? "",
    filepath: row[4] as string,
  }));

  return {
    orphans: items,
    count: items.length,
  };
}
