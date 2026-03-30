/**
 * Sync — scan all .grimoire/ markdown files and populate DuckDB.
 * Supports both full rebuild and incremental (content-hash based) sync.
 * Markdown files are the source of truth; the database is always rebuildable.
 */

import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
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

export interface DryRunChange {
  filepath: string;
  action: "add" | "update" | "remove";
}

export interface SyncResult {
  files_processed: number;
  documents_synced: number;
  relationships_synced: number;
  changelog_entries_synced: number;
  errors: SyncError[];
  incremental: boolean;
  dry_run?: boolean;
  changes?: DryRunChange[];
}

export interface SyncOptions {
  cwd?: string;
  /** Force a full rebuild even when incremental sync is available. */
  full?: boolean;
  /** Report what would change without writing to the database. */
  dryRun?: boolean;
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

/** Compute SHA-256 content hash for a file. */
async function hashFile(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
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

// ── File scanning ──────────────────────────────────────────────────────────

interface ScannedFile {
  filepath: string; // relative path within .grimoire/
  absolutePath: string;
  type: string;
  schema: z.ZodObject<z.ZodRawShape>;
}

/** Scan .grimoire/ and return all markdown file paths (not yet parsed). */
async function scanFiles(grimoireDir: string): Promise<ScannedFile[]> {
  const files: ScannedFile[] = [];

  // Overview
  files.push({
    filepath: "overview.md",
    absolutePath: join(grimoireDir, "overview.md"),
    type: "overview",
    schema: overviewFrontmatterSchema,
  });

  // Document subdirectories
  for (const [dirName, { type, schema }] of Object.entries(DIR_TYPE_MAP)) {
    const dirPath = join(grimoireDir, dirName);
    let entries: import("node:fs").Dirent[];
    try {
      entries = await readdir(dirPath, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push({
          filepath: join(dirName, entry.name),
          absolutePath: join(dirPath, entry.name),
          type,
          schema,
        });
      }
    }
  }

  return files;
}

/** Parse a single scanned file into a ParsedFile. */
function parseFile(scanned: ScannedFile): ParsedFile {
  const doc = readDocument(scanned.absolutePath, scanned.schema);
  return {
    filepath: scanned.filepath,
    type: scanned.type,
    frontmatter: doc.frontmatter as Record<string, unknown>,
    body: doc.body,
  };
}

// ── Database operations ────────────────────────────────────────────────────

/** Insert a single parsed document into the documents table. */
async function insertDocument(
  connection: Awaited<ReturnType<typeof getDatabase>>,
  file: ParsedFile,
): Promise<void> {
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
}

/** Extract relationships from all parsed files. */
function extractRelationships(
  parsed: ParsedFile[],
): Array<{ source: string; target: string; rel: string }> {
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

  return relationships;
}

/** Insert relationships, skipping those with missing source/target. */
async function insertRelationships(
  connection: Awaited<ReturnType<typeof getDatabase>>,
  relationships: Array<{ source: string; target: string; rel: string }>,
  documentIds: Set<string>,
  errors: SyncError[],
): Promise<number> {
  let count = 0;
  for (const rel of relationships) {
    if (!rel.source || !rel.target) continue;
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
      count++;
    } catch (err) {
      errors.push({
        file: rel.source,
        message: `Relationship insert failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
  return count;
}

/** Insert changelog/comment entries for the given parsed files. */
async function insertChangelog(
  connection: Awaited<ReturnType<typeof getDatabase>>,
  parsed: ParsedFile[],
  documentIds: Set<string>,
  errors: SyncError[],
): Promise<number> {
  let count = 0;
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
        count++;
      } catch (err) {
        errors.push({
          file: file.filepath,
          message: `Changelog insert failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }
  return count;
}

// ── Stored hash operations ─────────────────────────────────────────────────

/** Load stored content hashes from the database. Returns null if table is missing or empty (no prior sync). */
async function loadStoredHashes(
  connection: Awaited<ReturnType<typeof getDatabase>>,
): Promise<Map<string, string> | null> {
  try {
    const result = await connection.runAndReadAll(
      "SELECT filepath, content_hash FROM content_hashes",
    );
    const rows = result.getRows();
    if (rows.length === 0) return null;
    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row[0] as string, row[1] as string);
    }
    return map;
  } catch {
    return null;
  }
}

/** Save content hashes to the database (full replace). */
async function saveHashes(
  connection: Awaited<ReturnType<typeof getDatabase>>,
  hashes: Map<string, string>,
): Promise<void> {
  await connection.run("DELETE FROM content_hashes");
  for (const [filepath, hash] of hashes) {
    await connection.run(
      `INSERT INTO content_hashes (filepath, content_hash) VALUES (${sqlLiteral(filepath)}, ${sqlLiteral(hash)})`,
    );
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Sync .grimoire/ markdown files into DuckDB.
 * Uses incremental sync (content-hash based) by default; falls back to full
 * rebuild if the hash store is missing or `options.full` is true.
 */
export async function sync(options: SyncOptions = {}): Promise<SyncResult> {
  const cwd = options.cwd ?? process.cwd();
  const grimoireDir = join(cwd, GRIMOIRE_DIR);
  const errors: SyncError[] = [];

  // 1. Scan all files
  const scannedFiles = await scanFiles(grimoireDir);

  // 2. Compute current content hashes
  const currentHashes = new Map<string, string>();
  for (const file of scannedFiles) {
    try {
      const hash = await hashFile(file.absolutePath);
      currentHashes.set(file.filepath, hash);
    } catch (err) {
      errors.push({
        file: file.filepath,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 3. Open database
  const connection = await getDatabase(cwd);

  // 4. Load stored hashes (needed for both sync and dry-run)
  const storedHashes = await loadStoredHashes(connection);
  const isFullSync = options.full || !storedHashes;

  // 5. Handle dry-run mode
  if (options.dryRun) {
    return dryRun(scannedFiles, currentHashes, storedHashes, isFullSync, errors);
  }

  if (isFullSync) {
    return fullSync(connection, scannedFiles, currentHashes, errors);
  }

  return incrementalSync(connection, scannedFiles, currentHashes, storedHashes!, errors);
}

/**
 * Dry-run — compute what would change without writing to the database.
 */
function dryRun(
  scannedFiles: ScannedFile[],
  currentHashes: Map<string, string>,
  storedHashes: Map<string, string> | null,
  isFullSync: boolean,
  errors: SyncError[],
): SyncResult {
  const changes: DryRunChange[] = [];

  if (isFullSync) {
    // Full rebuild: every current file is effectively re-added
    for (const file of scannedFiles) {
      if (currentHashes.has(file.filepath)) {
        const action = storedHashes?.has(file.filepath) ? "update" : "add";
        changes.push({ filepath: file.filepath, action });
      }
    }
    // Files in stored hashes but not in current scan are removed
    if (storedHashes) {
      const currentFilepaths = new Set(currentHashes.keys());
      for (const filepath of storedHashes.keys()) {
        if (!currentFilepaths.has(filepath)) {
          changes.push({ filepath, action: "remove" });
        }
      }
    }
  } else {
    // Incremental: only changed/new/deleted files
    for (const file of scannedFiles) {
      const currentHash = currentHashes.get(file.filepath);
      if (!currentHash) continue;

      const storedHash = storedHashes!.get(file.filepath);
      if (!storedHash) {
        changes.push({ filepath: file.filepath, action: "add" });
      } else if (currentHash !== storedHash) {
        changes.push({ filepath: file.filepath, action: "update" });
      }
    }

    // Deleted files
    const currentFilepaths = new Set(currentHashes.keys());
    for (const filepath of storedHashes!.keys()) {
      if (!currentFilepaths.has(filepath)) {
        changes.push({ filepath, action: "remove" });
      }
    }
  }

  return {
    files_processed: changes.length,
    documents_synced: 0,
    relationships_synced: 0,
    changelog_entries_synced: 0,
    errors,
    incremental: !isFullSync,
    dry_run: true,
    changes,
  };
}

/**
 * Full rebuild — clear all tables and re-insert everything.
 */
async function fullSync(
  connection: Awaited<ReturnType<typeof getDatabase>>,
  scannedFiles: ScannedFile[],
  currentHashes: Map<string, string>,
  errors: SyncError[],
): Promise<SyncResult> {
  const parsed: ParsedFile[] = [];

  for (const scanned of scannedFiles) {
    try {
      parsed.push(parseFile(scanned));
    } catch (err) {
      errors.push({
        file: scanned.filepath,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Clear tables in dependency order
  await connection.run("DELETE FROM changelog_entries");
  await connection.run("DELETE FROM relationships");
  await connection.run("DELETE FROM documents");

  // Insert all documents
  let documentsInserted = 0;
  const documentIds = new Set<string>();

  for (const file of parsed) {
    try {
      await insertDocument(connection, file);
      documentIds.add(asStr(file.frontmatter.id));
      documentsInserted++;
    } catch (err) {
      errors.push({
        file: file.filepath,
        message: `DB insert failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // Insert relationships
  const relationships = extractRelationships(parsed);
  const relationshipsInserted = await insertRelationships(
    connection,
    relationships,
    documentIds,
    errors,
  );

  // Insert changelog entries
  const changelogInserted = await insertChangelog(connection, parsed, documentIds, errors);

  // Save hashes for future incremental syncs
  await saveHashes(connection, currentHashes);

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
    incremental: false,
  };
}

/**
 * Incremental sync — only re-process files whose content hash has changed.
 * Relationships and changelog are fully rebuilt since they are cross-document
 * and cheap to recompute.
 */
async function incrementalSync(
  connection: Awaited<ReturnType<typeof getDatabase>>,
  scannedFiles: ScannedFile[],
  currentHashes: Map<string, string>,
  storedHashes: Map<string, string>,
  errors: SyncError[],
): Promise<SyncResult> {
  // Determine changed, new, and deleted files
  const changedFiles: ScannedFile[] = [];
  const unchangedFiles: ScannedFile[] = [];

  for (const scanned of scannedFiles) {
    const currentHash = currentHashes.get(scanned.filepath);
    const storedHash = storedHashes.get(scanned.filepath);
    if (!currentHash) continue; // file couldn't be hashed (error already recorded)

    if (!storedHash || currentHash !== storedHash) {
      changedFiles.push(scanned);
    } else {
      unchangedFiles.push(scanned);
    }
  }

  // Detect deleted files: in stored hashes but not in current scan
  const currentFilepaths = new Set(currentHashes.keys());
  const deletedFilepaths: string[] = [];
  for (const filepath of storedHashes.keys()) {
    if (!currentFilepaths.has(filepath)) {
      deletedFilepaths.push(filepath);
    }
  }

  // Parse changed/new files
  const changedParsed: ParsedFile[] = [];
  for (const scanned of changedFiles) {
    try {
      changedParsed.push(parseFile(scanned));
    } catch (err) {
      errors.push({
        file: scanned.filepath,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Parse unchanged files (needed for relationship extraction)
  const unchangedParsed: ParsedFile[] = [];
  for (const scanned of unchangedFiles) {
    try {
      unchangedParsed.push(parseFile(scanned));
    } catch (err) {
      errors.push({
        file: scanned.filepath,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const allParsed = [...changedParsed, ...unchangedParsed];

  // Delete removed documents from all tables
  for (const filepath of deletedFilepaths) {
    try {
      // Get the document ID for this filepath
      const result = await connection.runAndReadAll(
        `SELECT id FROM documents WHERE filepath = ${sqlLiteral(filepath)}`,
      );
      const rows = result.getRows();
      for (const row of rows) {
        const docId = row[0] as string;
        await connection.run(
          `DELETE FROM changelog_entries WHERE document_id = ${sqlLiteral(docId)}`,
        );
        await connection.run(
          `DELETE FROM relationships WHERE source_id = ${sqlLiteral(docId)} OR target_id = ${sqlLiteral(docId)}`,
        );
        await connection.run(`DELETE FROM documents WHERE id = ${sqlLiteral(docId)}`);
      }
    } catch (err) {
      errors.push({
        file: filepath,
        message: `Delete failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // Clear relationships and changelog for changed documents before upserting
  // (FK constraints prevent upsert while references exist)
  await connection.run("DELETE FROM relationships");
  for (const file of changedParsed) {
    const id = asStr(file.frontmatter.id);
    await connection.run(`DELETE FROM changelog_entries WHERE document_id = ${sqlLiteral(id)}`);
  }

  // Upsert changed/new documents
  let documentsUpserted = 0;
  for (const file of changedParsed) {
    try {
      await insertDocument(connection, file);
      documentsUpserted++;
    } catch (err) {
      errors.push({
        file: file.filepath,
        message: `DB insert failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // Rebuild all relationships (cheap, ensures cross-document consistency)
  const documentIds = new Set<string>();
  for (const file of allParsed) {
    documentIds.add(asStr(file.frontmatter.id));
  }
  const relationships = extractRelationships(allParsed);
  const relationshipsInserted = await insertRelationships(
    connection,
    relationships,
    documentIds,
    errors,
  );

  // Insert changelog entries for changed documents
  const changelogInserted = await insertChangelog(connection, changedParsed, documentIds, errors);

  // Save updated hashes
  await saveHashes(connection, currentHashes);

  return {
    files_processed: changedFiles.length + deletedFilepaths.length,
    documents_synced: documentsUpserted,
    relationships_synced: relationshipsInserted,
    changelog_entries_synced: changelogInserted,
    errors,
    incremental: true,
  };
}
