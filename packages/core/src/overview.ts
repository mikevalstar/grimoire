import { access, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readDocument } from "./frontmatter.ts";
import {
  overviewFrontmatterSchema,
  overviewOptionsSchema,
  updateOverviewOptionsSchema,
  type OverviewOptions,
  type UpdateOverviewOptions,
  type OverviewFrontmatter,
} from "./schemas.ts";

export type { OverviewOptions, UpdateOverviewOptions };

export interface OverviewResult extends OverviewFrontmatter {
  body: string;
}

export interface UpdateOverviewResult {
  id: "overview";
  type: "overview";
  filepath: string;
  updated_fields: string[];
}

const GRIMOIRE_DIR = ".grimoire";
const OVERVIEW_FILE = "overview.md";

/**
 * Read and return the project overview document.
 */
export async function overview(options: Partial<OverviewOptions> = {}): Promise<OverviewResult> {
  const opts = overviewOptionsSchema.parse(options);
  const cwd = opts.cwd ?? process.cwd();
  const overviewPath = join(cwd, GRIMOIRE_DIR, OVERVIEW_FILE);

  // Check .grimoire/ exists
  try {
    await access(join(cwd, GRIMOIRE_DIR));
  } catch {
    throw new Error(
      "No .grimoire/ directory found. Run 'grimoire init' to initialize your project.",
    );
  }

  // Check overview.md exists
  try {
    await access(overviewPath);
  } catch {
    throw new Error("No overview.md found in .grimoire/. Run 'grimoire init' to create one.");
  }

  const { frontmatter, body } = readDocument(overviewPath, overviewFrontmatterSchema);

  let resultBody = body.trim();

  if (opts.compact) {
    // In compact mode, strip the changelog section
    const changelogIndex = resultBody.indexOf("## Changelog");
    if (changelogIndex !== -1) {
      const beforeChangelog = resultBody.slice(0, changelogIndex);
      resultBody = beforeChangelog.replace(/\n---\s*$/, "").trim();
    }
  }

  return {
    ...frontmatter,
    body: resultBody,
  };
}

/** Build frontmatter YAML for the overview document. */
function buildOverviewFrontmatter(fields: Record<string, unknown>): string {
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

/**
 * Update the project overview document.
 */
export async function updateOverview(
  options: UpdateOverviewOptions,
): Promise<UpdateOverviewResult> {
  const opts = updateOverviewOptionsSchema.parse(options);
  const cwd = opts.cwd ?? process.cwd();
  const today = new Date().toISOString().slice(0, 10);
  const overviewPath = join(cwd, GRIMOIRE_DIR, OVERVIEW_FILE);

  // Check .grimoire/ exists
  try {
    await access(join(cwd, GRIMOIRE_DIR));
  } catch {
    throw new Error(
      "No .grimoire/ directory found. Run 'grimoire init' to initialize your project.",
    );
  }

  // Check overview.md exists
  try {
    await access(overviewPath);
  } catch {
    throw new Error("No overview.md found in .grimoire/. Run 'grimoire init' to create one.");
  }

  const { frontmatter, body } = readDocument(overviewPath, overviewFrontmatterSchema);
  const fm = { ...(frontmatter as Record<string, unknown>) };
  const updatedFields: string[] = [];

  if (opts.title !== undefined) {
    fm.title = opts.title;
    updatedFields.push("title");
  }
  if (opts.description !== undefined) {
    fm.description = opts.description;
    updatedFields.push("description");
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

  // Handle body
  let newBody = body;
  if (opts.body !== undefined) {
    newBody = opts.body;
    updatedFields.push("body");
  } else if (opts.append !== undefined) {
    const changelogIndex = newBody.indexOf("---\n\n## Changelog");
    if (changelogIndex !== -1) {
      newBody =
        newBody.slice(0, changelogIndex).trimEnd() +
        "\n\n" +
        opts.append +
        "\n\n" +
        newBody.slice(changelogIndex);
    } else {
      newBody = newBody.trimEnd() + "\n\n" + opts.append;
    }
    updatedFields.push("body");
  }

  // Rebuild file
  const frontmatterYaml = buildOverviewFrontmatter(fm);
  const content = `${frontmatterYaml}\n\n${newBody.trim()}\n`;
  await writeFile(overviewPath, content);

  const relativePath = `${GRIMOIRE_DIR}/${OVERVIEW_FILE}`;
  return {
    id: "overview",
    type: "overview",
    filepath: relativePath,
    updated_fields: updatedFields,
  };
}
