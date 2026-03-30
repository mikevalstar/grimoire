/**
 * Tree — display the feature → requirement → task hierarchy.
 * Uses the `relationships` table to build a nested tree structure.
 */

import { z } from "zod";
import { getDatabase } from "./database.ts";
import { autoSync } from "./auto-sync.ts";

export interface TreeNode {
  id: string;
  title: string;
  type: string;
  status: string;
  children: TreeNode[];
}

export interface TreeResponse {
  tree: TreeNode[];
  count: number;
}

const treeOptionsSchema = z.object({
  feature: z.string().optional(),
  status: z.string().optional(),
  cwd: z.string().optional(),
});

export type TreeOptions = z.input<typeof treeOptionsSchema>;

/** Escape a string for SQL single-quoted literals. */
function esc(value: string): string {
  return value.replace(/'/g, "''");
}

interface DocRow {
  id: string;
  title: string;
  type: string;
  status: string;
}

interface RelRow {
  source_id: string;
  target_id: string;
  relationship: string;
}

/**
 * Build the feature → requirement → task hierarchy tree.
 */
export async function tree(options: TreeOptions = {}): Promise<TreeResponse> {
  const opts = treeOptionsSchema.parse(options);
  const cwd = opts.cwd ?? process.cwd();

  await autoSync(cwd);

  const connection = await getDatabase(cwd);

  // Load all documents (features, requirements, tasks)
  const docConditions = ["d.type IN ('feature', 'requirement', 'task')"];
  if (opts.status) {
    docConditions.push(`d.status = '${esc(opts.status)}'`);
  }

  const docResult = await connection.runAndReadAll(
    `SELECT id, title, type, status FROM documents d WHERE ${docConditions.join(" AND ")} ORDER BY type, title`,
  );
  const allDocs = new Map<string, DocRow>();
  for (const row of docResult.getRows()) {
    const doc: DocRow = {
      id: row[0] as string,
      title: row[1] as string,
      type: row[2] as string,
      status: (row[3] as string) ?? "",
    };
    allDocs.set(doc.id, doc);
  }

  // Load hierarchy relationships
  const relResult = await connection.runAndReadAll(
    `SELECT source_id, target_id, relationship FROM relationships
     WHERE relationship IN ('has_requirement', 'has_task', 'parent_feature', 'parent_requirement')`,
  );
  const rels: RelRow[] = relResult.getRows().map((row) => ({
    source_id: row[0] as string,
    target_id: row[1] as string,
    relationship: row[2] as string,
  }));

  // Build parent→children maps
  // Feature → requirements (via has_requirement or requirement's parent_feature)
  // Requirement → tasks (via has_task or task's parent_requirement)
  const featureReqs = new Map<string, Set<string>>();
  const reqTasks = new Map<string, Set<string>>();
  const hasParent = new Set<string>();

  for (const rel of rels) {
    if (rel.relationship === "has_requirement") {
      const set = featureReqs.get(rel.source_id) ?? new Set();
      set.add(rel.target_id);
      featureReqs.set(rel.source_id, set);
      hasParent.add(rel.target_id);
    } else if (
      rel.relationship === "parent_feature" &&
      allDocs.get(rel.source_id)?.type === "requirement"
    ) {
      const set = featureReqs.get(rel.target_id) ?? new Set();
      set.add(rel.source_id);
      featureReqs.set(rel.target_id, set);
      hasParent.add(rel.source_id);
    } else if (rel.relationship === "has_task") {
      const set = reqTasks.get(rel.source_id) ?? new Set();
      set.add(rel.target_id);
      reqTasks.set(rel.source_id, set);
      hasParent.add(rel.target_id);
    } else if (
      rel.relationship === "parent_requirement" &&
      allDocs.get(rel.source_id)?.type === "task"
    ) {
      const set = reqTasks.get(rel.target_id) ?? new Set();
      set.add(rel.source_id);
      reqTasks.set(rel.target_id, set);
      hasParent.add(rel.source_id);
    }
  }

  // Build tree nodes
  const buildNode = (id: string, visited: Set<string>): TreeNode | null => {
    const doc = allDocs.get(id);
    if (!doc) return null;
    if (visited.has(id)) return null; // circular dependency guard
    visited.add(id);

    const children: TreeNode[] = [];

    if (doc.type === "feature") {
      for (const reqId of featureReqs.get(id) ?? []) {
        const child = buildNode(reqId, visited);
        if (child) children.push(child);
      }
    } else if (doc.type === "requirement") {
      for (const taskId of reqTasks.get(id) ?? []) {
        const child = buildNode(taskId, visited);
        if (child) children.push(child);
      }
    }

    children.sort((a, b) => a.title.localeCompare(b.title));

    return { id: doc.id, title: doc.title, type: doc.type, status: doc.status, children };
  };

  const roots: TreeNode[] = [];

  if (opts.feature) {
    // Show tree for a specific feature
    const node = buildNode(opts.feature, new Set());
    if (!node) {
      throw new Error(`Feature not found: ${opts.feature}`);
    }
    roots.push(node);
  } else {
    // All features as roots, plus orphaned requirements and tasks
    for (const doc of allDocs.values()) {
      if (doc.type === "feature") {
        const node = buildNode(doc.id, new Set());
        if (node) roots.push(node);
      }
    }

    // Add parentless requirements at root level
    for (const doc of allDocs.values()) {
      if (doc.type === "requirement" && !hasParent.has(doc.id)) {
        const node = buildNode(doc.id, new Set());
        if (node) roots.push(node);
      }
    }

    // Add parentless tasks at root level
    for (const doc of allDocs.values()) {
      if (doc.type === "task" && !hasParent.has(doc.id)) {
        const node = buildNode(doc.id, new Set());
        if (node) roots.push(node);
      }
    }

    roots.sort((a, b) => a.title.localeCompare(b.title));
  }

  // Count all nodes
  const countNodes = (nodes: TreeNode[]): number =>
    nodes.reduce((sum, n) => sum + 1 + countNodes(n.children), 0);

  return {
    tree: roots,
    count: countNodes(roots),
  };
}
