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
