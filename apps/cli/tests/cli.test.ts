import { expect, test, describe, beforeEach, afterEach } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { mkdtemp, rm, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cli = resolve(import.meta.dirname, "../dist/index.mjs");

function run(args: string[]): string {
  return execFileSync("node", [cli, ...args], {
    encoding: "utf-8",
  }).trim();
}

function runErr(args: string[]): string {
  try {
    execFileSync("node", [cli, ...args], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    throw new Error("expected non-zero exit");
  } catch (err: unknown) {
    return (err as { stderr: string }).stderr.trim();
  }
}

test("--version prints version", () => {
  const output = run(["--version"]);
  expect(output).toMatch(/^\d+\.\d+\.\d+$/);
});

test("--help includes description", () => {
  const output = run(["--help"]);
  expect(output).toContain("Grimoire AI");
});

describe("init command", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "grimoire-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("requires --name flag", () => {
    const stderr = runErr(["init", "--cwd", tempDir]);
    const parsed = JSON.parse(stderr);
    expect(parsed.error).toContain("name");
  });

  test("creates .grimoire/ directory structure", () => {
    const output = run(["init", "--name", "Test Project", "--cwd", tempDir]);
    const result = JSON.parse(output);

    expect(result.success).toBe(true);
    expect(result.created).toContain(".grimoire/");
    expect(result.created).toContain(".grimoire/features/");
    expect(result.created).toContain(".grimoire/requirements/");
    expect(result.created).toContain(".grimoire/tasks/");
    expect(result.created).toContain(".grimoire/decisions/");
    expect(result.created).toContain(".grimoire/.cache/");
    expect(result.created).toContain(".grimoire/overview.md");
    expect(result.created).toContain(".grimoire/config.yaml");
  });

  test("creates overview.md with project name", async () => {
    run(["init", "--name", "Test Project", "--description", "A test", "--cwd", tempDir]);
    const overview = await readFile(join(tempDir, ".grimoire/overview.md"), "utf-8");

    expect(overview).toContain('title: "Test Project"');
    expect(overview).toContain('description: "A test"');
    expect(overview).toContain("# Test Project");
  });

  test("creates config.yaml with project name", async () => {
    run(["init", "--name", "Test Project", "--cwd", tempDir]);
    const config = await readFile(join(tempDir, ".grimoire/config.yaml"), "utf-8");

    expect(config).toContain('name: "Test Project"');
    expect(config).toContain("provider: local");
  });

  test("creates skill files by default", async () => {
    run(["init", "--name", "Test Project", "--cwd", tempDir]);

    const skillsDir = join(tempDir, ".grimoire/.skills");
    await access(skillsDir); // throws if doesn't exist

    const overview = await readFile(join(skillsDir, "OVERVIEW.md"), "utf-8");
    expect(overview).toContain("Grimoire AI");
  });

  test("skips skill files with --skip-skills", () => {
    const output = run(["init", "--name", "Test Project", "--skip-skills", "--cwd", tempDir]);
    const result = JSON.parse(output);

    expect(result.created).not.toContain(".grimoire/.skills/");
  });

  test("updates .gitignore with cache entry", async () => {
    run(["init", "--name", "Test Project", "--cwd", tempDir]);
    const gitignore = await readFile(join(tempDir, ".gitignore"), "utf-8");

    expect(gitignore).toContain(".grimoire/.cache/");
  });

  test("creates CLAUDE.md with grimoire section when no agents file exists", async () => {
    const output = run(["init", "--name", "Test Project", "--cwd", tempDir]);
    const result = JSON.parse(output);

    expect(result.agents_file_updated).toBe(true);

    const claudeMd = await readFile(join(tempDir, "CLAUDE.md"), "utf-8");
    expect(claudeMd).toContain("<!--GRIMOIRE START-->");
    expect(claudeMd).toContain("<!--GRIMOIRE END-->");
    expect(claudeMd).toContain("grimoire overview");
  });

  test("fails if .grimoire/ already exists", () => {
    run(["init", "--name", "Test Project", "--cwd", tempDir]);

    const stderr = runErr(["init", "--name", "Test Project", "--cwd", tempDir]);
    const parsed = JSON.parse(stderr);
    expect(parsed.error).toContain("already exists");
  });
});

describe("overview command", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "grimoire-test-"));
    // Initialize a grimoire project for overview tests
    run(["init", "--name", "Test Project", "--description", "A test project", "--cwd", tempDir]);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("reads overview document", () => {
    const output = run(["overview", "--cwd", tempDir]);
    const result = JSON.parse(output);

    expect(result.id).toBe("overview");
    expect(result.title).toBe("Test Project");
    expect(result.description).toBe("A test project");
    expect(result.type).toBe("overview");
    expect(result.tags).toEqual([]);
    expect(result.body).toContain("# Test Project");
  });

  test("compact mode strips changelog", () => {
    const output = run(["overview", "--compact", "--cwd", tempDir]);
    const result = JSON.parse(output);

    expect(result.body).toContain("# Test Project");
    expect(result.body).not.toContain("## Changelog");
  });

  test("fails when no .grimoire/ directory exists", async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), "grimoire-empty-"));
    try {
      const stderr = runErr(["overview", "--cwd", emptyDir]);
      const parsed = JSON.parse(stderr);
      expect(parsed.error).toContain("grimoire init");
    } finally {
      await rm(emptyDir, { recursive: true, force: true });
    }
  });
});

describe("log and comment commands", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "grimoire-test-"));
    run(["init", "--name", "Test Project", "--cwd", tempDir]);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function createFeature(): string {
    const output = run(["feature", "create", "--title", "Test Feature", "--cwd", tempDir]);
    return JSON.parse(output).id;
  }

  test("grimoire log appends a changelog entry", async () => {
    const id = createFeature();
    const output = run(["log", id, "Implemented the thing.", "--cwd", tempDir]);
    const result = JSON.parse(output);

    expect(result.success).toBe(true);
    expect(result.id).toBe(id);
    expect(result.section).toBe("changelog");
    expect(result.author).toBe("agent");

    const content = await readFile(join(tempDir, ".grimoire/features", `${id}.md`), "utf-8");
    expect(content).toContain("Implemented the thing.");
    expect(content).toContain("## Changelog");
    // Entry should appear after ## Changelog, not in ## Comments
    const changelogIdx = content.indexOf("## Changelog");
    const entryIdx = content.indexOf("Implemented the thing.");
    expect(entryIdx).toBeGreaterThan(changelogIdx);
  });

  test("grimoire log --comment appends to comments section", async () => {
    const id = createFeature();
    const output = run(["log", id, "Should we add pagination?", "--comment", "--cwd", tempDir]);
    const result = JSON.parse(output);

    expect(result.success).toBe(true);
    expect(result.section).toBe("comments");

    const content = await readFile(join(tempDir, ".grimoire/features", `${id}.md`), "utf-8");
    expect(content).toContain("> Should we add pagination?");
    // Comment should appear between ## Comments and ## Changelog
    const commentsIdx = content.indexOf("## Comments");
    const changelogIdx = content.indexOf("## Changelog");
    const entryIdx = content.indexOf("> Should we add pagination?");
    expect(entryIdx).toBeGreaterThan(commentsIdx);
    expect(entryIdx).toBeLessThan(changelogIdx);
  });

  test("grimoire comment is shorthand for log --comment", async () => {
    const id = createFeature();
    const output = run(["comment", id, "Is this the right approach?", "--cwd", tempDir]);
    const result = JSON.parse(output);

    expect(result.success).toBe(true);
    expect(result.section).toBe("comments");

    const content = await readFile(join(tempDir, ".grimoire/features", `${id}.md`), "utf-8");
    expect(content).toContain("> Is this the right approach?");
  });

  test("--author sets custom author", async () => {
    const id = createFeature();
    const output = run(["log", id, "Fixed the bug.", "--author", "mike", "--cwd", tempDir]);
    const result = JSON.parse(output);

    expect(result.author).toBe("mike");

    const content = await readFile(join(tempDir, ".grimoire/features", `${id}.md`), "utf-8");
    expect(content).toContain("| mike");
  });

  test("resolves by uid", async () => {
    const id = createFeature();
    const uid = id.split("-")[1]; // extract uid from feat-XXXXX-title
    const output = run(["log", uid, "Logged by uid.", "--cwd", tempDir]);
    const result = JSON.parse(output);

    expect(result.success).toBe(true);
    expect(result.id).toBe(id);
  });

  test("entries include date and time", async () => {
    const id = createFeature();
    run(["log", id, "Time test.", "--cwd", tempDir]);

    const content = await readFile(join(tempDir, ".grimoire/features", `${id}.md`), "utf-8");
    // Match pattern: ### YYYY-MM-DD HH:mm | agent
    expect(content).toMatch(/### \d{4}-\d{2}-\d{2} \d{2}:\d{2} \| agent\nTime test\./);
  });

  test("updates the updated field in frontmatter", async () => {
    const id = createFeature();
    run(["log", id, "Some change.", "--cwd", tempDir]);

    const content = await readFile(join(tempDir, ".grimoire/features", `${id}.md`), "utf-8");
    const today = new Date().toISOString().slice(0, 10);
    expect(content).toContain(`updated: "${today}"`);
  });

  test("fails for non-existent ID", () => {
    const stderr = runErr(["log", "nonexistent-id", "message", "--cwd", tempDir]);
    const parsed = JSON.parse(stderr);
    expect(parsed.error).toContain("not found");
  });

  test("works across document types", async () => {
    // Create a task and log to it
    const taskOutput = run(["task", "create", "--title", "Test Task", "--cwd", tempDir]);
    const taskId = JSON.parse(taskOutput).id;

    const output = run(["log", taskId, "Started work.", "--cwd", tempDir]);
    const result = JSON.parse(output);

    expect(result.success).toBe(true);
    expect(result.type).toBe("task");
    expect(result.id).toBe(taskId);
  });
});
