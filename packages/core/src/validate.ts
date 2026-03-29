import { readdir, access } from "node:fs/promises";
import { join } from "node:path";
import { readDocument } from "./frontmatter.ts";
import {
  type DocumentType,
  type ValidateOptions,
  validateOptionsSchema,
  featureFrontmatterSchema,
  requirementFrontmatterSchema,
  taskFrontmatterSchema,
  decisionFrontmatterSchema,
  overviewFrontmatterSchema,
  documentTypes,
} from "./schemas.ts";

const GRIMOIRE_DIR = ".grimoire";

const TYPE_DIRS: Record<DocumentType, string> = {
  feature: "features",
  requirement: "requirements",
  task: "tasks",
  decision: "decisions",
};

const TYPE_SCHEMAS: Record<DocumentType, Parameters<typeof readDocument>[1]> = {
  feature: featureFrontmatterSchema,
  requirement: requirementFrontmatterSchema,
  task: taskFrontmatterSchema,
  decision: decisionFrontmatterSchema,
};

export interface ValidateIssue {
  severity: "error" | "warning";
  type: "schema" | "broken_link" | "orphan" | "missing_field" | "id_mismatch" | "missing_overview";
  document?: string;
  field?: string;
  message: string;
}

export interface ValidateResult {
  valid: boolean;
  errors: number;
  warnings: number;
  issues: ValidateIssue[];
}

interface ParsedDoc {
  id: string;
  type: DocumentType;
  filename: string;
  frontmatter: Record<string, unknown>;
}

/** Extract all relationship fields from a document's frontmatter by type. */
function getRelationshipFields(
  type: DocumentType,
  fm: Record<string, unknown>,
): Array<{ field: string; targets: string[] }> {
  const rels: Array<{ field: string; targets: string[] }> = [];

  const addArray = (field: string) => {
    const val = fm[field];
    if (Array.isArray(val) && val.length > 0) {
      rels.push({ field, targets: val.filter((v) => typeof v === "string" && v !== "") });
    }
  };

  const addString = (field: string) => {
    const val = fm[field];
    if (typeof val === "string" && val !== "") {
      rels.push({ field, targets: [val] });
    }
  };

  if (type === "feature") {
    addArray("requirements");
    addArray("decisions");
  } else if (type === "requirement") {
    addString("feature");
    addArray("tasks");
    addArray("depends_on");
  } else if (type === "task") {
    addString("requirement");
    addString("feature");
    addArray("depends_on");
  } else if (type === "decision") {
    addArray("features");
    addString("supersedes");
    addString("superseded_by");
  }

  return rels;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function validate(options: ValidateOptions): Promise<ValidateResult> {
  const opts = validateOptionsSchema.parse(options);
  const cwd = opts.cwd ?? process.cwd();
  const grimoireDir = join(cwd, GRIMOIRE_DIR);
  const issues: ValidateIssue[] = [];

  if (!(await pathExists(grimoireDir))) {
    throw new Error(
      "No .grimoire/ directory found. Run 'grimoire init' to initialize your project.",
    );
  }

  // 1. Check overview.md exists and parses
  const overviewPath = join(grimoireDir, "overview.md");
  if (!(await pathExists(overviewPath))) {
    issues.push({
      severity: "error",
      type: "missing_overview",
      document: "overview.md",
      message: "overview.md is missing from .grimoire/",
    });
  } else {
    try {
      readDocument(overviewPath, overviewFrontmatterSchema);
    } catch (err) {
      issues.push({
        severity: "error",
        type: "schema",
        document: "overview.md",
        message: `overview.md schema error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // 2. Scan all document types and parse
  const allDocs: ParsedDoc[] = [];
  const allIds = new Set<string>();

  for (const type of documentTypes) {
    const typeDir = join(grimoireDir, TYPE_DIRS[type]);
    let files: string[];
    try {
      files = (await readdir(typeDir)).filter((f) => f.endsWith(".md"));
    } catch {
      // Directory doesn't exist — that's fine, no docs of this type
      continue;
    }

    const schema = TYPE_SCHEMAS[type];

    for (const file of files) {
      const filepath = join(typeDir, file);
      const filenameId = file.replace(/\.md$/, "");

      try {
        const { frontmatter } = readDocument(filepath, schema);
        const fm = frontmatter as Record<string, unknown>;
        const docId = fm.id as string;

        // Check required fields are non-empty
        for (const field of ["id", "uid", "title"]) {
          const val = fm[field];
          if (val === undefined || val === null || val === "") {
            issues.push({
              severity: "error",
              type: "missing_field",
              document: docId || filenameId,
              field,
              message: `Required field "${field}" is empty in ${TYPE_DIRS[type]}/${file}`,
            });
          }
        }

        // Check ID matches filename
        if (docId && docId !== filenameId) {
          issues.push({
            severity: "error",
            type: "id_mismatch",
            document: docId,
            message: `Frontmatter id "${docId}" does not match filename "${filenameId}" in ${TYPE_DIRS[type]}/${file}`,
          });
        }

        allIds.add(docId || filenameId);
        allDocs.push({ id: docId || filenameId, type, filename: file, frontmatter: fm });
      } catch (err) {
        issues.push({
          severity: "error",
          type: "schema",
          document: filenameId,
          message: `Schema validation failed for ${TYPE_DIRS[type]}/${file}: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }

  // 3. Check broken links
  const referencedIds = new Set<string>();

  for (const doc of allDocs) {
    const rels = getRelationshipFields(doc.type, doc.frontmatter);
    for (const { field, targets } of rels) {
      for (const target of targets) {
        referencedIds.add(target);
        if (!allIds.has(target)) {
          issues.push({
            severity: "error",
            type: "broken_link",
            document: doc.id,
            field,
            message: `Field "${field}" references unknown document "${target}"`,
          });
        }
      }
    }
  }

  // 4. Check orphans — documents with no inbound or outbound relationships
  for (const doc of allDocs) {
    const rels = getRelationshipFields(doc.type, doc.frontmatter);
    const hasOutbound = rels.some((r) => r.targets.length > 0);
    const hasInbound = referencedIds.has(doc.id);
    if (!hasOutbound && !hasInbound) {
      issues.push({
        severity: "warning",
        type: "orphan",
        document: doc.id,
        message: `No relationships to other documents`,
      });
    }
  }

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;

  return {
    valid: errors === 0,
    errors,
    warnings,
    issues,
  };
}
