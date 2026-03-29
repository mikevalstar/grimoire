import { access } from "node:fs/promises";
import { join } from "node:path";
import { readDocument } from "./frontmatter.ts";
import {
  overviewFrontmatterSchema,
  overviewOptionsSchema,
  type OverviewOptions,
  type OverviewFrontmatter,
} from "./schemas.ts";

export type { OverviewOptions };

export interface OverviewResult extends OverviewFrontmatter {
  body: string;
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
