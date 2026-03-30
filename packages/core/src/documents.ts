import { mkdir, readdir, writeFile, rename, rm, access } from "node:fs/promises";
import { join } from "node:path";
import { customAlphabet } from "nanoid";
import { readDocument } from "./frontmatter.ts";
import { readFile, writeFile as fsWriteFile } from "node:fs/promises";
import {
  type DocumentType,
  type CreateDocumentOptions,
  type GetDocumentOptions,
  type ListDocumentsOptions,
  type UpdateDocumentOptions,
  type DeleteDocumentOptions,
  type AppendLogOptions,
  type AppendCommentOptions,
  createDocumentOptionsSchema,
  getDocumentOptionsSchema,
  listDocumentsOptionsSchema,
  updateDocumentOptionsSchema,
  deleteDocumentOptionsSchema,
  appendLogOptionsSchema,
  appendCommentOptionsSchema,
  featureFrontmatterSchema,
  requirementFrontmatterSchema,
  taskFrontmatterSchema,
  decisionFrontmatterSchema,
  documentTypes,
} from "./schemas.ts";

const GRIMOIRE_DIR = ".grimoire";
const ARCHIVE_DIR = ".archive";

/** Map document type to its subdirectory name. */
const TYPE_DIRS: Record<DocumentType, string> = {
  feature: "features",
  requirement: "requirements",
  task: "tasks",
  decision: "decisions",
};

/** Map document type to its ID prefix. */
const TYPE_PREFIXES: Record<DocumentType, string> = {
  feature: "feat",
  requirement: "req",
  task: "task",
  decision: "adr",
};

/** Map document type to its Zod frontmatter schema. */
const TYPE_SCHEMAS: Record<DocumentType, Parameters<typeof readDocument>[1]> = {
  feature: featureFrontmatterSchema,
  requirement: requirementFrontmatterSchema,
  task: taskFrontmatterSchema,
  decision: decisionFrontmatterSchema,
};

/** Default statuses per type. */
const DEFAULT_STATUS: Record<DocumentType, string> = {
  feature: "proposed",
  requirement: "draft",
  task: "todo",
  decision: "proposed",
};

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a document identifier (full ID, uid, or partial match) to a full ID.
 * Scans the type directory for a matching file.
 * Accepts: full ID ("feat-x7kq2-user-auth"), uid only ("x7kq2"), or type-prefixed uid ("feat-x7kq2").
 */
export async function resolveDocumentId(
  cwd: string,
  type: DocumentType,
  input: string,
): Promise<string> {
  const grimoireDir = join(cwd, GRIMOIRE_DIR);
  const typeDir = join(grimoireDir, TYPE_DIRS[type]);

  let files: string[];
  try {
    files = (await readdir(typeDir)).filter((f) => f.endsWith(".md"));
  } catch {
    throw new Error(
      "No .grimoire/ directory found. Run 'grimoire init' to initialize your project.",
    );
  }

  // Exact match first (input is the full ID)
  if (files.includes(`${input}.md`)) {
    return input;
  }

  // Match by uid: scan frontmatter for uid field, or match against filename pattern
  // Filename pattern: <prefix>-<uid>-<slug>.md
  const prefix = TYPE_PREFIXES[type];
  for (const file of files) {
    const basename = file.replace(/\.md$/, "");
    // Extract uid from filename: prefix-XXXXX-slug
    const afterPrefix = basename.slice(prefix.length + 1); // skip "feat-"
    const uid = afterPrefix.slice(0, 5); // first 5 chars are the uid

    if (input === uid || input === `${prefix}-${uid}`) {
      return basename;
    }
  }

  throw new Error(
    `Document '${input}' not found in ${TYPE_DIRS[type]}/. Provide a full ID or 5-character uid.`,
  );
}

/** Ensure the .grimoire/ directory and the type subdirectory exist. */
async function ensureTypeDir(cwd: string, type: DocumentType): Promise<string> {
  const grimoireDir = join(cwd, GRIMOIRE_DIR);
  if (!(await exists(grimoireDir))) {
    throw new Error(
      "No .grimoire/ directory found. Run 'grimoire init' to initialize your project.",
    );
  }
  const typeDir = join(grimoireDir, TYPE_DIRS[type]);
  await mkdir(typeDir, { recursive: true });
  return typeDir;
}

const generateUid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 5);

/** Generate an ID from title with type prefix and unique nanoid. */
function generateId(type: DocumentType, title: string): { id: string; uid: string } {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const uid = generateUid();
  return { id: `${TYPE_PREFIXES[type]}-${uid}-${slug}`, uid };
}

/** Build the frontmatter YAML for a document. */
function buildFrontmatter(type: DocumentType, fields: Record<string, unknown>): string {
  const lines: string[] = ["---"];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${item}`);
        }
      }
    } else if (typeof value === "string" && value.includes('"')) {
      lines.push(`${key}: '${value}'`);
    } else if (typeof value === "string") {
      lines.push(`${key}: "${value}"`);
    } else if (typeof value === "number" || typeof value === "boolean") {
      lines.push(`${key}: ${String(value)}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

// --- Result types ---

export interface CreateDocumentResult {
  id: string;
  uid: string;
  type: DocumentType;
  filepath: string;
  title: string;
}

export interface GetDocumentResult {
  id: string;
  type: DocumentType;
  filepath: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

export interface ListDocumentsResult {
  type: DocumentType;
  count: number;
  documents: Array<{
    id: string;
    uid: string;
    title: string;
    status: string;
    priority: string;
    updated: string;
    filepath: string;
  }>;
}

export interface UpdateDocumentResult {
  id: string;
  type: DocumentType;
  filepath: string;
  updated_fields: string[];
}

export interface DeleteDocumentResult {
  id: string;
  type: DocumentType;
  action: "archived" | "deleted";
  filepath: string;
}

// --- CRUD functions ---

export async function createDocument(
  options: CreateDocumentOptions,
): Promise<CreateDocumentResult> {
  const opts = createDocumentOptionsSchema.parse(options);
  const cwd = opts.cwd ?? process.cwd();
  const type = opts.type;
  const today = new Date().toISOString().slice(0, 10);

  const typeDir = await ensureTypeDir(cwd, type);
  const generated = generateId(type, opts.title);
  const id = opts.id ?? generated.id;
  const uid = generated.uid;

  // Check for duplicate
  const filename = `${id}.md`;
  const filepath = join(typeDir, filename);
  if (await exists(filepath)) {
    throw new Error(`Document '${id}' already exists at ${TYPE_DIRS[type]}/${filename}`);
  }

  // Build frontmatter fields based on type
  const base: Record<string, unknown> = {
    id,
    uid,
    title: opts.title,
    type,
    status: opts.status ?? DEFAULT_STATUS[type],
    priority: opts.priority ?? "medium",
    created: today,
    updated: today,
    tags: opts.tags,
  };

  // Type-specific fields
  if (type === "feature") {
    base.requirements = [];
    base.decisions = [];
  } else if (type === "requirement") {
    base.feature = opts.feature ?? "";
    base.tasks = [];
    base.depends_on = [];
  } else if (type === "task") {
    base.requirement = opts.requirement ?? "";
    base.feature = opts.feature ?? "";
    base.assignee = "";
    base.depends_on = [];
  } else if (type === "decision") {
    base.date = today;
    base.features = opts.feature ? [opts.feature] : [];
    base.supersedes = "";
    base.superseded_by = "";
  }

  const frontmatter = buildFrontmatter(type, base);
  const body = opts.body || `# ${opts.title}`;
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const tail = `---\n\n## Comments\n\n---\n\n## Changelog\n\n### ${today} ${time} | grimoire\nDocument created.\n`;
  const content = `${frontmatter}\n\n${body}\n\n${tail}`;

  await writeFile(filepath, content);

  const relativePath = `${GRIMOIRE_DIR}/${TYPE_DIRS[type]}/${filename}`;
  return { id, uid, type, filepath: relativePath, title: opts.title };
}

export async function getDocument(options: GetDocumentOptions): Promise<GetDocumentResult> {
  const opts = getDocumentOptionsSchema.parse(options);
  const cwd = opts.cwd ?? process.cwd();
  const type = opts.type;

  const typeDir = await ensureTypeDir(cwd, type);
  const filename = `${opts.id}.md`;
  const filepath = join(typeDir, filename);

  if (!(await exists(filepath))) {
    throw new Error(`Document '${opts.id}' not found in ${TYPE_DIRS[type]}/`);
  }

  const schema = TYPE_SCHEMAS[type];
  const { frontmatter, body } = readDocument(filepath, schema);

  let resultBody = body.trim();

  if (opts.metadataOnly) {
    resultBody = "";
  } else if (opts.noChangelog) {
    const changelogIndex = resultBody.indexOf("## Changelog");
    if (changelogIndex !== -1) {
      resultBody = resultBody
        .slice(0, changelogIndex)
        .replace(/\n---\s*$/, "")
        .trim();
    }
  }

  const relativePath = `${GRIMOIRE_DIR}/${TYPE_DIRS[type]}/${filename}`;
  return {
    id: opts.id,
    type,
    filepath: relativePath,
    frontmatter: frontmatter as Record<string, unknown>,
    body: resultBody,
  };
}

export async function listDocuments(options: ListDocumentsOptions): Promise<ListDocumentsResult> {
  const opts = listDocumentsOptionsSchema.parse(options);
  const cwd = opts.cwd ?? process.cwd();
  const type = opts.type;

  const typeDir = await ensureTypeDir(cwd, type);

  // Read all .md files in the directory
  let files: string[];
  try {
    files = (await readdir(typeDir)).filter((f) => f.endsWith(".md"));
  } catch {
    files = [];
  }

  const schema = TYPE_SCHEMAS[type];
  const documents: ListDocumentsResult["documents"] = [];

  for (const file of files) {
    try {
      const { frontmatter } = readDocument(join(typeDir, file), schema);
      const fm = frontmatter as Record<string, unknown>;

      // Apply filters
      if (opts.status && fm.status !== opts.status) continue;
      if (opts.priority && fm.priority !== opts.priority) continue;
      if (opts.tag) {
        const tags = (fm.tags as string[]) ?? [];
        if (!tags.includes(opts.tag)) continue;
      }
      if (opts.feature) {
        // For requirements/tasks, check feature field; for decisions, check features array
        if (type === "decision") {
          const features = (fm.features as string[]) ?? [];
          if (!features.includes(opts.feature)) continue;
        } else if (type === "requirement" || type === "task") {
          if (fm.feature !== opts.feature) continue;
        }
      }

      documents.push({
        id: fm.id as string,
        uid: (fm.uid as string) ?? "",
        title: fm.title as string,
        status: (fm.status as string) ?? "",
        priority: (fm.priority as string) ?? "",
        updated: (fm.updated as string) ?? "",
        filepath: `${GRIMOIRE_DIR}/${TYPE_DIRS[type]}/${file}`,
      });
    } catch {
      // Skip files that fail to parse
    }
  }

  // Sort
  const sortField = opts.sort as keyof (typeof documents)[0];
  documents.sort((a, b) => {
    const av = a[sortField] ?? "";
    const bv = b[sortField] ?? "";
    return bv.localeCompare(av); // descending by default
  });

  // Limit
  const limited = opts.limit ? documents.slice(0, opts.limit) : documents;

  return { type, count: limited.length, documents: limited };
}

/**
 * Split a document body into content, comments section, and changelog section.
 * Comments and changelog are returned with their leading `---\n\n` separator preserved.
 */
export function splitBodySections(body: string): {
  content: string;
  comments: string;
  changelog: string;
} {
  const commentsIndex = body.indexOf("---\n\n## Comments");
  const changelogIndex = body.indexOf("---\n\n## Changelog");

  let content = body;
  let comments = "";
  let changelog = "";

  if (commentsIndex !== -1 && changelogIndex !== -1) {
    content = body.slice(0, commentsIndex);
    comments = body.slice(commentsIndex, changelogIndex);
    changelog = body.slice(changelogIndex);
  } else if (changelogIndex !== -1) {
    content = body.slice(0, changelogIndex);
    changelog = body.slice(changelogIndex);
  } else if (commentsIndex !== -1) {
    content = body.slice(0, commentsIndex);
    comments = body.slice(commentsIndex);
  }

  // Ensure sections have leading newlines for clean concatenation
  if (comments && !comments.startsWith("\n")) comments = "\n\n" + comments;
  if (changelog && !changelog.startsWith("\n")) changelog = "\n\n" + changelog;

  return { content, comments, changelog };
}

export async function updateDocument(
  options: UpdateDocumentOptions,
): Promise<UpdateDocumentResult> {
  const opts = updateDocumentOptionsSchema.parse(options);
  const cwd = opts.cwd ?? process.cwd();
  const type = opts.type;
  const today = new Date().toISOString().slice(0, 10);

  const typeDir = await ensureTypeDir(cwd, type);
  const filename = `${opts.id}.md`;
  const filepath = join(typeDir, filename);

  if (!(await exists(filepath))) {
    throw new Error(`Document '${opts.id}' not found in ${TYPE_DIRS[type]}/`);
  }

  const schema = TYPE_SCHEMAS[type];
  const { frontmatter, body } = readDocument(filepath, schema);
  const fm = { ...(frontmatter as Record<string, unknown>) };
  const updatedFields: string[] = [];

  // Apply updates to frontmatter
  if (opts.title !== undefined) {
    fm.title = opts.title;
    updatedFields.push("title");
  }
  if (opts.status !== undefined) {
    fm.status = opts.status;
    updatedFields.push("status");
  }
  if (opts.priority !== undefined) {
    fm.priority = opts.priority;
    updatedFields.push("priority");
  }
  if (opts.feature !== undefined) {
    if (type === "decision") {
      const features = (fm.features as string[]) ?? [];
      if (!features.includes(opts.feature)) {
        fm.features = [...features, opts.feature];
        updatedFields.push("features");
      }
    } else {
      fm.feature = opts.feature;
      updatedFields.push("feature");
    }
  }
  if (opts.requirement !== undefined && type === "task") {
    fm.requirement = opts.requirement;
    updatedFields.push("requirement");
  }

  // Tag operations
  if (opts.addTag.length > 0) {
    const tags = new Set((fm.tags as string[]) ?? []);
    for (const tag of opts.addTag) tags.add(tag);
    fm.tags = [...tags];
    updatedFields.push("tags");
  }
  if (opts.removeTag.length > 0) {
    const tags = new Set((fm.tags as string[]) ?? []);
    for (const tag of opts.removeTag) tags.delete(tag);
    fm.tags = [...tags];
    updatedFields.push("tags");
  }

  fm.updated = today;

  // Handle body — preserve Comments and Changelog sections
  let newBody = body;
  const sections = splitBodySections(newBody);
  if (opts.body !== undefined) {
    newBody = opts.body.trimEnd() + sections.comments + sections.changelog;
    updatedFields.push("body");
  } else if (opts.append !== undefined) {
    newBody =
      sections.content.trimEnd() + "\n\n" + opts.append + sections.comments + sections.changelog;
    updatedFields.push("body");
  }

  // Rebuild file
  const frontmatterYaml = buildFrontmatter(type, fm);
  const content = `${frontmatterYaml}\n\n${newBody.trim()}\n`;
  await writeFile(filepath, content);

  const relativePath = `${GRIMOIRE_DIR}/${TYPE_DIRS[type]}/${filename}`;
  return { id: opts.id, type, filepath: relativePath, updated_fields: updatedFields };
}

export async function deleteDocument(
  options: DeleteDocumentOptions,
): Promise<DeleteDocumentResult> {
  const opts = deleteDocumentOptionsSchema.parse(options);
  const cwd = opts.cwd ?? process.cwd();
  const type = opts.type;

  const typeDir = await ensureTypeDir(cwd, type);
  const filename = `${opts.id}.md`;
  const filepath = join(typeDir, filename);

  if (!(await exists(filepath))) {
    throw new Error(`Document '${opts.id}' not found in ${TYPE_DIRS[type]}/`);
  }

  const relativePath = `${GRIMOIRE_DIR}/${TYPE_DIRS[type]}/${filename}`;

  if (opts.hard) {
    await rm(filepath);
    return { id: opts.id, type, action: "deleted", filepath: relativePath };
  }

  // Archive: move to .grimoire/.archive/<type>/
  const archiveDir = join(cwd, GRIMOIRE_DIR, ARCHIVE_DIR, TYPE_DIRS[type]);
  await mkdir(archiveDir, { recursive: true });
  const archivePath = join(archiveDir, filename);
  await rename(filepath, archivePath);

  return { id: opts.id, type, action: "archived", filepath: relativePath };
}

// --- Type-agnostic ID resolution ---

const PREFIX_TO_TYPE: Record<string, DocumentType> = {
  feat: "feature",
  req: "requirement",
  task: "task",
  adr: "decision",
};

export interface ResolvedDocument {
  type: DocumentType;
  id: string;
  filepath: string;
}

/**
 * Resolve a document ID across all document types.
 * Tries prefix-based type inference first, then scans all types by uid.
 */
export async function resolveDocumentIdAnyType(
  cwd: string,
  input: string,
): Promise<ResolvedDocument> {
  const grimoireDir = join(cwd, GRIMOIRE_DIR);

  // Try to infer type from prefix
  const prefixMatch = input.match(/^(feat|req|task|adr)-/);
  if (prefixMatch) {
    const type = PREFIX_TO_TYPE[prefixMatch[1]];
    if (type) {
      try {
        const id = await resolveDocumentId(cwd, type, input);
        const filepath = join(grimoireDir, TYPE_DIRS[type], `${id}.md`);
        return { type, id, filepath };
      } catch {
        // Fall through to scan all types
      }
    }
  }

  // Scan all types (for uid-only lookups)
  for (const type of documentTypes) {
    try {
      const id = await resolveDocumentId(cwd, type, input);
      const filepath = join(grimoireDir, TYPE_DIRS[type], `${id}.md`);
      return { type, id, filepath };
    } catch {
      // Continue to next type
    }
  }

  throw new Error(
    `Document '${input}' not found. Provide a full ID (e.g., feat-x7kq2-title) or 5-character uid.`,
  );
}

// --- Append log / comment ---

export interface AppendEntryResult {
  id: string;
  type: DocumentType;
  filepath: string;
  date: string;
  author: string;
  section: "changelog" | "comments";
}

function formatTimestamp(): { date: string; time: string } {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return { date, time };
}

function buildEntry(
  date: string,
  time: string,
  author: string,
  message: string,
  blockquote: boolean,
): string {
  const lines = message.split("\n");
  const body = blockquote ? lines.map((line) => `> ${line}`).join("\n") : message;
  return `### ${date} ${time} | ${author}\n${body}\n`;
}

function updateUpdatedField(content: string, date: string): string {
  return content.replace(/^(updated:\s*).+$/m, `$1"${date}"`);
}

export async function appendLog(options: AppendLogOptions): Promise<AppendEntryResult> {
  const opts = appendLogOptionsSchema.parse(options);
  const cwd = opts.cwd ?? process.cwd();
  const { type, id, filepath } = await resolveDocumentIdAnyType(cwd, opts.id);

  const content = await readFile(filepath, "utf-8");
  const { date, time } = formatTimestamp();
  const entry = buildEntry(date, time, opts.author, opts.message, false);

  let newContent: string;
  const changelogIdx = content.indexOf("## Changelog");
  if (changelogIdx !== -1) {
    // Append after the ## Changelog header line
    const afterHeader = content.indexOf("\n", changelogIdx);
    newContent = content.slice(0, afterHeader + 1) + "\n" + entry + content.slice(afterHeader + 1);
  } else {
    // No changelog section — append both sections
    newContent = content.trimEnd() + "\n\n---\n\n## Comments\n\n---\n\n## Changelog\n\n" + entry;
  }

  newContent = updateUpdatedField(newContent, date);
  await fsWriteFile(filepath, newContent);

  const relativePath = `${GRIMOIRE_DIR}/${TYPE_DIRS[type]}/${id}.md`;
  return {
    id,
    type,
    filepath: relativePath,
    date: `${date} ${time}`,
    author: opts.author,
    section: "changelog",
  };
}

export async function appendComment(options: AppendCommentOptions): Promise<AppendEntryResult> {
  const opts = appendCommentOptionsSchema.parse(options);
  const cwd = opts.cwd ?? process.cwd();
  const { type, id, filepath } = await resolveDocumentIdAnyType(cwd, opts.id);

  const content = await readFile(filepath, "utf-8");
  const { date, time } = formatTimestamp();
  const entry = buildEntry(date, time, opts.author, opts.message, true);

  let newContent: string;
  const commentsIdx = content.indexOf("## Comments");
  if (commentsIdx !== -1) {
    // Find the separator between Comments and Changelog: "---\n\n## Changelog"
    const separatorIdx = content.indexOf("---\n\n## Changelog", commentsIdx);
    if (separatorIdx !== -1) {
      // Insert before the separator
      newContent =
        content.slice(0, separatorIdx).trimEnd() +
        "\n\n" +
        entry +
        "\n" +
        content.slice(separatorIdx);
    } else {
      // Comments section exists but no changelog after it — append at end of comments
      const afterHeader = content.indexOf("\n", commentsIdx);
      newContent =
        content.slice(0, afterHeader + 1) + "\n" + entry + content.slice(afterHeader + 1);
    }
  } else {
    // No comments section — create both sections with the comment
    const changelogIdx = content.indexOf("## Changelog");
    if (changelogIdx !== -1) {
      // Insert Comments section before the existing --- before Changelog
      const beforeChangelog = content.lastIndexOf("---", changelogIdx);
      if (beforeChangelog !== -1) {
        newContent =
          content.slice(0, beforeChangelog).trimEnd() +
          "\n\n---\n\n## Comments\n\n" +
          entry +
          "\n" +
          content.slice(beforeChangelog);
      } else {
        newContent =
          content.slice(0, changelogIdx).trimEnd() +
          "\n\n---\n\n## Comments\n\n" +
          entry +
          "\n" +
          content.slice(changelogIdx);
      }
    } else {
      // No sections at all
      newContent =
        content.trimEnd() + "\n\n---\n\n## Comments\n\n" + entry + "\n---\n\n## Changelog\n";
    }
  }

  newContent = updateUpdatedField(newContent, date);
  await fsWriteFile(filepath, newContent);

  const relativePath = `${GRIMOIRE_DIR}/${TYPE_DIRS[type]}/${id}.md`;
  return {
    id,
    type,
    filepath: relativePath,
    date: `${date} ${time}`,
    author: opts.author,
    section: "comments",
  };
}
