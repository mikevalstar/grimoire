/**
 * Full sync rebuild — scan all .grimoire/ markdown files and populate DuckDB.
 * Markdown files are the source of truth; this rebuilds the database from scratch.
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { getDatabase } from "./database.ts";
import { readDocument } from "./frontmatter.ts";
import { splitBodySections } from "./documents.ts";
import {
  overviewFrontmatterSchema,
  featureFrontmatterSchema,
  requirementFrontmatterSchema,
  taskFrontmatterSchema,
  decisionFrontmatterSchema,
} from "./schemas.ts";
import type { z } from "zod";

const GRIMOIRE_DIR = ".grimoire";

/** Map subdirectory names to document type and schema. */
const DIR_TYPE_MAP: Record<string, { type: string; schema: z.ZodObject<z.ZodRawShape> }> = {
  features: { type: "feature", schema: featureFrontmatterSchema },
  requirements: { type: "requirement", schema: requirementFrontmatterSchema },
  tasks: { type: "task", schema: taskFrontmatterSchema },
  decisions: { type: "decision", schema: decisionFrontmatterSchema },
};

export interface SyncError {
  file: string;
  message: string;
}

export interface SyncResult {
  files_processed: number;
  documents_synced: number;
  relationships_synced: number;
  changelog_entries_synced: number;
  errors: SyncError[];
}

export interface SyncOptions {
  cwd?: string;
}

interface ParsedFile {
  filepath: string;
  type: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

/** Escape a string for use in a SQL single-quoted literal. */
function esc(value: string): string {
  return value.replace(/'/g, "''");
}

/** Safely extract a string from an unknown value. */
function asStr(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return JSON.stringify(value);
}

/** Normalize a date string to YYYY-MM-DD format that DuckDB accepts. */
function normalizeDate(value: unknown): string | null {
  if (value == null) return null;
  const str = asStr(value);
  if (!str) return null;
  // Already YYYY-MM-DD or YYYY-MM-DD HH:MM:SS — DuckDB handles these
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str;
  // Try parsing as a Date (handles "Sat Mar 28 2026 ..." etc.)
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Format a value as a SQL literal (string, null, or array). */
function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (Array.isArray(value)) {
    const items = value.map((v) => `'${esc(asStr(v))}'`).join(", ");
    return `[${items}]`;
  }
  return `'${esc(asStr(value))}'`;
}

/**
 * Scan all .grimoire/ markdown files and rebuild DuckDB tables from scratch.
 */
export async function sync(options: SyncOptions = {}): Promise<SyncResult> {
  const cwd = options.cwd ?? process.cwd();
  const grimoireDir = join(cwd, GRIMOIRE_DIR);
  const errors: SyncError[] = [];
  const parsed: ParsedFile[] = [];

  // 1. Scan and parse all markdown files
  // Overview
  try {
    const doc = readDocument(join(grimoireDir, "overview.md"), overviewFrontmatterSchema);
    parsed.push({
      filepath: "overview.md",
      type: "overview",
      frontmatter: doc.frontmatter as Record<string, unknown>,
      body: doc.body,
    });
  } catch (err) {
    errors.push({
      file: "overview.md",
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // Document subdirectories
  for (const [dirName, { type, schema }] of Object.entries(DIR_TYPE_MAP)) {
    const dirPath = join(grimoireDir, dirName);
    let files: string[];
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      files = entries.filter((e) => e.isFile() && e.name.endsWith(".md")).map((e) => e.name);
    } catch {
      // Directory may not exist — that's fine
      continue;
    }

    for (const fileName of files) {
      const filePath = join(dirPath, fileName);
      const relPath = join(dirName, fileName);
      try {
        const doc = readDocument(filePath, schema);
        parsed.push({
          filepath: relPath,
          type,
          frontmatter: doc.frontmatter as Record<string, unknown>,
          body: doc.body,
        });
      } catch (err) {
        errors.push({
          file: relPath,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // 2. Open database and rebuild
  const connection = await getDatabase(cwd);

  // Clear tables in dependency order (changelog_entries and relationships reference documents)
  await connection.run("DELETE FROM changelog_entries");
  await connection.run("DELETE FROM relationships");
  await connection.run("DELETE FROM documents");

  // 3. Insert all documents
  let documentsInserted = 0;
  const documentIds = new Set<string>();

  for (const file of parsed) {
    try {
      const fm = file.frontmatter;
      const id = asStr(fm.id);
      const title = asStr(fm.title);
      const status = fm.status != null ? asStr(fm.status) : null;
      const priority = fm.priority != null ? asStr(fm.priority) : null;
      const created = normalizeDate(fm.created);
      const updated = normalizeDate(fm.updated);
      const tags = Array.isArray(fm.tags) ? fm.tags.map(asStr) : [];

      const { content } = splitBodySections(file.body);

      await connection.run(
        `INSERT INTO documents (id, title, type, status, priority, created, updated, tags, filepath, body, frontmatter)
         VALUES (${sqlLiteral(id)}, ${sqlLiteral(title)}, ${sqlLiteral(file.type)}, ${sqlLiteral(status)}, ${sqlLiteral(priority)}, ${sqlLiteral(created)}, ${sqlLiteral(updated)}, ${sqlLiteral(tags)}, ${sqlLiteral(file.filepath)}, ${sqlLiteral(content.trim())}, ${sqlLiteral(JSON.stringify(fm))})
         ON CONFLICT (id) DO UPDATE SET
           title = excluded.title,
           type = excluded.type,
           status = excluded.status,
           priority = excluded.priority,
           created = excluded.created,
           updated = excluded.updated,
           tags = excluded.tags,
           filepath = excluded.filepath,
           body = excluded.body,
           frontmatter = excluded.frontmatter`,
      );
      documentIds.add(id);
      documentsInserted++;
    } catch (err) {
      errors.push({
        file: file.filepath,
        message: `DB insert failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // 4. Extract and insert relationships
  let relationshipsInserted = 0;
  const relationships: Array<{ source: string; target: string; rel: string }> = [];

  for (const file of parsed) {
    const fm = file.frontmatter;
    const id = asStr(fm.id);

    switch (file.type) {
      case "feature":
        for (const reqId of asStringArray(fm.requirements)) {
          relationships.push({ source: id, target: reqId, rel: "has_requirement" });
        }
        for (const decId of asStringArray(fm.decisions)) {
          relationships.push({ source: id, target: decId, rel: "has_decision" });
        }
        break;

      case "requirement": {
        const feat = asStr(fm.feature);
        if (feat) {
          relationships.push({ source: id, target: feat, rel: "parent_feature" });
        }
        for (const taskId of asStringArray(fm.tasks)) {
          relationships.push({ source: id, target: taskId, rel: "has_task" });
        }
        for (const depId of asStringArray(fm.depends_on)) {
          relationships.push({ source: id, target: depId, rel: "depends_on" });
        }
        break;
      }

      case "task": {
        const req = asStr(fm.requirement);
        if (req) {
          relationships.push({ source: id, target: req, rel: "parent_requirement" });
        }
        const feat = asStr(fm.feature);
        if (feat) {
          relationships.push({ source: id, target: feat, rel: "parent_feature" });
        }
        for (const depId of asStringArray(fm.depends_on)) {
          relationships.push({ source: id, target: depId, rel: "depends_on" });
        }
        break;
      }

      case "decision": {
        for (const featId of asStringArray(fm.features)) {
          relationships.push({ source: id, target: featId, rel: "has_feature" });
        }
        const supersedes = asStr(fm.supersedes);
        if (supersedes) {
          relationships.push({ source: id, target: supersedes, rel: "supersedes" });
        }
        const supersededBy = asStr(fm.superseded_by);
        if (supersededBy) {
          relationships.push({ source: id, target: supersededBy, rel: "superseded_by" });
        }
        break;
      }
    }
  }

  for (const rel of relationships) {
    if (!rel.source || !rel.target) continue;
    // Only insert if both documents exist in the database
    if (!documentIds.has(rel.source) || !documentIds.has(rel.target)) {
      errors.push({
        file: rel.source,
        message: `Relationship ${rel.rel} → ${rel.target}: target document not found`,
      });
      continue;
    }
    try {
      await connection.run(
        `INSERT INTO relationships (source_id, target_id, relationship)
         VALUES (${sqlLiteral(rel.source)}, ${sqlLiteral(rel.target)}, ${sqlLiteral(rel.rel)})
         ON CONFLICT DO NOTHING`,
      );
      relationshipsInserted++;
    } catch (err) {
      errors.push({
        file: rel.source,
        message: `Relationship insert failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // 5. Parse and insert changelog/comment entries
  let changelogInserted = 0;

  for (const file of parsed) {
    const id = asStr(file.frontmatter.id);
    if (!documentIds.has(id)) continue;

    const { comments, changelog } = splitBodySections(file.body);
    const entries = [
      ...parseChangelogSection(comments, true),
      ...parseChangelogSection(changelog, false),
    ];

    for (const entry of entries) {
      try {
        await connection.run(
          `INSERT INTO changelog_entries (document_id, date, author, content, is_comment)
           VALUES (${sqlLiteral(id)}, ${sqlLiteral(entry.date)}, ${sqlLiteral(entry.author)}, ${sqlLiteral(entry.content)}, ${sqlLiteral(entry.isComment)})`,
        );
        changelogInserted++;
      } catch (err) {
        errors.push({
          file: file.filepath,
          message: `Changelog insert failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }

  return {
    files_processed:
      parsed.length +
      errors.filter(
        (e) =>
          !e.message.startsWith("DB ") &&
          !e.message.startsWith("Relationship") &&
          !e.message.startsWith("Changelog"),
      ).length,
    documents_synced: documentsInserted,
    relationships_synced: relationshipsInserted,
    changelog_entries_synced: changelogInserted,
    errors,
  };
}

/** Safely coerce a value to string[], filtering out empty strings. */
function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter((s) => s.length > 0);
}

interface ChangelogEntry {
  date: string;
  author: string | null;
  content: string;
  isComment: boolean;
}

/**
 * Parse a changelog or comments section into structured entries.
 * Expects headers like: ### 2026-03-29 10:30 | author
 * Content follows until the next ### header or end of section.
 */
function parseChangelogSection(section: string, isCommentSection: boolean): ChangelogEntry[] {
  if (!section.trim()) return [];

  const entries: ChangelogEntry[] = [];
  // Match ### YYYY-MM-DD [HH:MM] [| author]
  const headerRegex = /^### (\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2}))?\s*(?:\|\s*(.+?))?$/gm;

  let match: RegExpExecArray | null;
  const headers: Array<{ index: number; date: string; author: string | null }> = [];

  while ((match = headerRegex.exec(section)) !== null) {
    headers.push({
      index: match.index + match[0].length,
      date: match[1]!,
      author: match[3]?.trim() || null,
    });
  }

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]!;
    const nextIndex =
      i + 1 < headers.length ? section.lastIndexOf("###", headers[i + 1]!.index) : section.length;
    const rawContent = section.slice(header.index, nextIndex).trim();

    if (!rawContent) continue;

    // For comment sections, strip blockquote markers
    const content = isCommentSection
      ? rawContent
          .split("\n")
          .map((line) => line.replace(/^>\s?/, ""))
          .join("\n")
          .trim()
      : rawContent;

    if (!content) continue;

    entries.push({
      date: header.date,
      author: header.author,
      content,
      isComment: isCommentSection,
    });
  }

  return entries;
}
