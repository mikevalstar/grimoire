/**
 * Status — project-wide dashboard with document counts, health indicators,
 * recent changes, and task summaries.
 */

import { z } from "zod";
import { getDatabase } from "./database.ts";
import { autoSync } from "./auto-sync.ts";

export interface StatusCounts {
  features: number;
  requirements: number;
  tasks: number;
  decisions: number;
  total: number;
}

export interface StatusByStatus {
  [type: string]: { [status: string]: number };
}

export interface RecentDocument {
  id: string;
  title: string;
  type: string;
  status: string;
  updated: string;
}

export interface StatusResponse {
  counts: StatusCounts;
  by_status: StatusByStatus;
  open_tasks: number;
  blocked_tasks: number;
  orphaned_documents: number;
  stale_documents: number;
  stale_threshold_days: number;
  recent: RecentDocument[];
}

const statusOptionsSchema = z.object({
  limit: z.number().int().positive().default(10),
  staleDays: z.number().int().positive().default(30),
  cwd: z.string().optional(),
});

export type StatusOptions = z.input<typeof statusOptionsSchema>;

/**
 * Generate a project status dashboard.
 */
export async function status(options: StatusOptions = {}): Promise<StatusResponse> {
  const opts = statusOptionsSchema.parse(options);
  const cwd = opts.cwd ?? process.cwd();

  await autoSync(cwd);

  const connection = await getDatabase(cwd);

  // Counts by type
  const countsResult = await connection.runAndReadAll(
    "SELECT type, COUNT(*) as cnt FROM documents WHERE type != 'overview' GROUP BY type",
  );
  const counts: StatusCounts = { features: 0, requirements: 0, tasks: 0, decisions: 0, total: 0 };
  for (const row of countsResult.getRows()) {
    const type = row[0] as string;
    const cnt = Number(row[1]);
    if (type === "feature") counts.features = cnt;
    else if (type === "requirement") counts.requirements = cnt;
    else if (type === "task") counts.tasks = cnt;
    else if (type === "decision") counts.decisions = cnt;
    counts.total += cnt;
  }

  // Counts by type and status
  const byStatusResult = await connection.runAndReadAll(
    "SELECT type, status, COUNT(*) as cnt FROM documents WHERE type != 'overview' GROUP BY type, status ORDER BY type, status",
  );
  const byStatus: StatusByStatus = {};
  for (const row of byStatusResult.getRows()) {
    const type = row[0] as string;
    const st = (row[1] as string) ?? "unknown";
    const cnt = Number(row[2]);
    if (!byStatus[type]) byStatus[type] = {};
    byStatus[type]![st] = cnt;
  }

  // Open and blocked tasks
  const taskStatusResult = await connection.runAndReadAll(
    "SELECT status, COUNT(*) as cnt FROM documents WHERE type = 'task' AND status IN ('todo', 'in-progress', 'blocked') GROUP BY status",
  );
  let openTasks = 0;
  let blockedTasks = 0;
  for (const row of taskStatusResult.getRows()) {
    const st = row[0] as string;
    const cnt = Number(row[1]);
    if (st === "blocked") blockedTasks = cnt;
    openTasks += cnt;
  }

  // Orphaned documents (not in any relationship, excluding overview)
  const orphanResult = await connection.runAndReadAll(
    `SELECT COUNT(*) FROM documents d
     WHERE d.type != 'overview'
       AND d.id NOT IN (SELECT source_id FROM relationships)
       AND d.id NOT IN (SELECT target_id FROM relationships)`,
  );
  const orphanedDocuments = Number(orphanResult.getRows()[0]![0]);

  // Stale documents (not updated in > N days)
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - opts.staleDays);
  const staleDateStr = staleDate.toISOString().slice(0, 10);
  const staleResult = await connection.runAndReadAll(
    `SELECT COUNT(*) FROM documents WHERE type != 'overview' AND updated IS NOT NULL AND updated < '${staleDateStr}'`,
  );
  const staleDocuments = Number(staleResult.getRows()[0]![0]);

  // Recently updated documents
  const recentResult = await connection.runAndReadAll(
    `SELECT id, title, type, status, updated FROM documents
     WHERE type != 'overview' AND updated IS NOT NULL
     ORDER BY updated DESC
     LIMIT ${opts.limit}`,
  );
  const recent: RecentDocument[] = recentResult.getRows().map((row) => ({
    id: row[0] as string,
    title: row[1] as string,
    type: row[2] as string,
    status: (row[3] as string) ?? "",
    updated: String(row[4]).slice(0, 10),
  }));

  return {
    counts,
    by_status: byStatus,
    open_tasks: openTasks,
    blocked_tasks: blockedTasks,
    orphaned_documents: orphanedDocuments,
    stale_documents: staleDocuments,
    stale_threshold_days: opts.staleDays,
    recent,
  };
}
