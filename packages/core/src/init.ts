import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import {
  configTemplate,
  overviewTemplate,
  agentsSectionTemplate,
  skillFiles,
} from "./templates/index.ts";
import { initOptionsSchema, type InitOptions } from "./schemas.ts";

export type { InitOptions };

export interface InitResult {
  grimoireDir: string;
  created: string[];
  gitignoreUpdated: boolean;
  agentsFileUpdated: boolean;
  agentsFilePath: string | null;
  warnings: string[];
}

const GRIMOIRE_DIR = ".grimoire";
const CACHE_DIR = ".cache";
const SKILLS_DIR = ".skills";
const GITIGNORE_ENTRY = ".grimoire/.cache/";
const GRIMOIRE_START_TAG = "<!--GRIMOIRE START-->";

const DOCUMENT_DIRS = ["features", "requirements", "tasks", "decisions"];

const AGENTS_FILE_NAMES = ["CLAUDE.md", "AGENTS.md"];

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize a .grimoire/ directory in the given project root.
 */
export async function init(options: InitOptions): Promise<InitResult> {
  const opts = initOptionsSchema.parse(options);
  const cwd = opts.cwd ?? process.cwd();
  const description = opts.description;
  const grimoireDir = join(cwd, GRIMOIRE_DIR);
  const created: string[] = [];
  const warnings: string[] = [];

  // Check if .grimoire/ already exists
  if (await exists(grimoireDir)) {
    throw new Error(
      `.grimoire/ directory already exists at ${grimoireDir}. Use 'grimoire sync' to rebuild the database.`,
    );
  }

  // Create directory structure
  await mkdir(grimoireDir, { recursive: true });
  created.push(GRIMOIRE_DIR + "/");

  for (const dir of DOCUMENT_DIRS) {
    const dirPath = join(grimoireDir, dir);
    await mkdir(dirPath, { recursive: true });
    created.push(`${GRIMOIRE_DIR}/${dir}/`);
  }

  const cacheDir = join(grimoireDir, CACHE_DIR);
  await mkdir(cacheDir, { recursive: true });
  created.push(`${GRIMOIRE_DIR}/${CACHE_DIR}/`);

  // Write overview.md
  const overviewPath = join(grimoireDir, "overview.md");
  await writeFile(overviewPath, overviewTemplate(opts.name, description));
  created.push(`${GRIMOIRE_DIR}/overview.md`);

  // Write config.yaml
  const configPath = join(grimoireDir, "config.yaml");
  await writeFile(configPath, configTemplate(opts.name, description));
  created.push(`${GRIMOIRE_DIR}/config.yaml`);

  // Write skill files
  if (!opts.skipSkills) {
    const skillsDir = join(grimoireDir, SKILLS_DIR);
    await mkdir(skillsDir, { recursive: true });
    created.push(`${GRIMOIRE_DIR}/${SKILLS_DIR}/`);

    for (const [filename, content] of Object.entries(skillFiles)) {
      const skillPath = join(skillsDir, filename);
      await writeFile(skillPath, content);
      created.push(`${GRIMOIRE_DIR}/${SKILLS_DIR}/${filename}`);
    }
  }

  // Update .gitignore
  const gitignoreUpdated = await ensureGitignore(cwd);

  // Update agents file (CLAUDE.md or AGENTS.md)
  const agentsResult = await ensureAgentsSection(cwd);

  return {
    grimoireDir,
    created,
    gitignoreUpdated,
    agentsFileUpdated: agentsResult.updated,
    agentsFilePath: agentsResult.filePath,
    warnings,
  };
}

/**
 * Ensure .gitignore contains .grimoire/.cache/
 */
async function ensureGitignore(cwd: string): Promise<boolean> {
  const gitignorePath = join(cwd, ".gitignore");
  let content = "";

  if (await exists(gitignorePath)) {
    content = await readFile(gitignorePath, "utf-8");
    // Check if already present
    const lines = content.split("\n").map((l) => l.trim());
    if (lines.includes(GITIGNORE_ENTRY)) {
      return false;
    }
  }

  // Append the entry
  const suffix = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
  const addition = `${suffix}\n# Grimoire AI cache (derived from markdown files)\n${GITIGNORE_ENTRY}\n`;
  await writeFile(gitignorePath, content + addition);
  return true;
}

/**
 * Find the agents file (CLAUDE.md or AGENTS.md) and inject the grimoire section
 * if the marker tags are not present.
 */
async function ensureAgentsSection(
  cwd: string,
): Promise<{ updated: boolean; filePath: string | null }> {
  // Find the first existing agents file
  let agentsFilePath: string | null = null;
  for (const name of AGENTS_FILE_NAMES) {
    const candidate = join(cwd, name);
    if (await exists(candidate)) {
      agentsFilePath = candidate;
      break;
    }
  }

  // If no agents file exists, create CLAUDE.md
  if (agentsFilePath === null) {
    agentsFilePath = join(cwd, AGENTS_FILE_NAMES[0]);
    await writeFile(agentsFilePath, agentsSectionTemplate + "\n");
    return { updated: true, filePath: AGENTS_FILE_NAMES[0] };
  }

  const content = await readFile(agentsFilePath, "utf-8");

  // Check if tags already present
  if (content.includes(GRIMOIRE_START_TAG)) {
    return { updated: false, filePath: null };
  }

  // Append the section
  const suffix = content.endsWith("\n") ? "\n" : "\n\n";
  await writeFile(agentsFilePath, content + suffix + agentsSectionTemplate + "\n");

  // Return relative filename
  const relativeName = AGENTS_FILE_NAMES.find((n) => join(cwd, n) === agentsFilePath);
  return { updated: true, filePath: relativeName ?? agentsFilePath };
}
