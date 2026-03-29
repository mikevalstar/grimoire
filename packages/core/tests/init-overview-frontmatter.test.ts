import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import {
  featureFrontmatterSchema,
  init,
  overview,
  parseDocument,
  readDocument,
} from "../src/index.ts";

describe("frontmatter helpers", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "grimoire-core-helpers-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("parseDocument returns body and applies schema defaults", () => {
    const result = parseDocument(
      `---
id: "feat-abc12-auth"
uid: "abc12"
title: "Auth"
---

# Auth

Body text.`,
      featureFrontmatterSchema,
    );

    expect(result.frontmatter.type).toBe("feature");
    expect(result.frontmatter.status).toBe("proposed");
    expect(result.frontmatter.tags).toEqual([]);
    expect(result.body).toContain("Body text.");
  });

  test("readDocument reads markdown from disk", async () => {
    const filePath = join(tempDir, "feature.md");
    await writeFile(
      filePath,
      `---
id: "feat-abc12-auth"
uid: "abc12"
title: "Auth"
priority: high
---

# Auth

From disk.`,
    );

    const result = readDocument(filePath, featureFrontmatterSchema);

    expect(result.frontmatter.priority).toBe("high");
    expect(result.body).toContain("From disk.");
  });
});

describe("overview", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "grimoire-core-overview-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("returns the full overview body by default", async () => {
    await init({
      name: "Test Project",
      description: "Project summary",
      cwd: tempDir,
    });

    const result = await overview({ cwd: tempDir });

    expect(result.title).toBe("Test Project");
    expect(result.body).toContain("Project summary");
    expect(result.body).toContain("## Changelog");
  });

  test("compact mode strips the changelog separator and section", async () => {
    await init({
      name: "Compact Project",
      description: "Compact summary",
      cwd: tempDir,
    });

    const result = await overview({ cwd: tempDir, compact: true });

    expect(result.body).toContain("Compact summary");
    expect(result.body).not.toContain("## Changelog");
    expect(result.body.trimEnd()).not.toMatch(/---$/);
  });

  test("throws when the .grimoire directory is missing", async () => {
    await expect(overview({ cwd: tempDir })).rejects.toThrow(
      "No .grimoire/ directory found. Run 'grimoire init' to initialize your project.",
    );
  });

  test("throws when overview.md is missing", async () => {
    await init({
      name: "Broken Project",
      description: "",
      cwd: tempDir,
    });
    await unlink(join(tempDir, ".grimoire", "overview.md"));

    await expect(overview({ cwd: tempDir })).rejects.toThrow(
      "No overview.md found in .grimoire/. Run 'grimoire init' to create one.",
    );
  });
});

describe("init", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "grimoire-core-init-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("creates CLAUDE.md when no agents file exists", async () => {
    const result = await init({
      name: "Init Project",
      description: "",
      cwd: tempDir,
    });

    const claude = await readFile(join(tempDir, "CLAUDE.md"), "utf-8");

    expect(result.agentsFileUpdated).toBe(true);
    expect(result.agentsFilePath).toBe("CLAUDE.md");
    expect(claude).toContain("<!--GRIMOIRE START-->");
  });

  test("appends the agents section to an existing AGENTS.md file", async () => {
    await writeFile(join(tempDir, "AGENTS.md"), "# Team Notes");

    const result = await init({
      name: "Init Project",
      description: "",
      cwd: tempDir,
    });

    const agents = await readFile(join(tempDir, "AGENTS.md"), "utf-8");

    expect(result.agentsFileUpdated).toBe(true);
    expect(result.agentsFilePath).toBe("AGENTS.md");
    expect(agents).toContain("# Team Notes");
    expect(agents).toContain("## Grimoire AI");
  });

  test("does not rewrite AGENTS.md when the grimoire section already exists", async () => {
    await writeFile(
      join(tempDir, "AGENTS.md"),
      "<!--GRIMOIRE START-->\nexisting\n<!--GRIMOIRE END-->\n",
    );

    const result = await init({
      name: "Init Project",
      description: "",
      cwd: tempDir,
    });

    const agents = await readFile(join(tempDir, "AGENTS.md"), "utf-8");

    expect(result.agentsFileUpdated).toBe(false);
    expect(result.agentsFilePath).toBeNull();
    expect(agents).toBe("<!--GRIMOIRE START-->\nexisting\n<!--GRIMOIRE END-->\n");
  });

  test("does not duplicate the cache entry when .gitignore already contains it", async () => {
    await writeFile(join(tempDir, ".gitignore"), ".grimoire/.cache/\n");

    const result = await init({
      name: "Init Project",
      description: "",
      cwd: tempDir,
    });

    const gitignore = await readFile(join(tempDir, ".gitignore"), "utf-8");

    expect(result.gitignoreUpdated).toBe(false);
    expect(gitignore).toBe(".grimoire/.cache/\n");
  });
});
