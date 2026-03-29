import { expect, test, describe, beforeEach, afterEach } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

const cli = resolve(import.meta.dirname, "../dist/index.mjs");

const noColorEnv = { ...process.env, NO_COLOR: "1" };

function run(args: string[]): string {
  return execFileSync("node", [cli, ...args], {
    encoding: "utf-8",
    env: noColorEnv,
  }).trim();
}

function runErr(args: string[]): string {
  try {
    execFileSync("node", [cli, ...args], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: noColorEnv,
    });
    throw new Error("expected non-zero exit");
  } catch (err: unknown) {
    return (err as { stderr: string }).stderr.trim();
  }
}

describe("--format flag", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "grimoire-format-"));
    run(["init", "--name", "Format Test", "--description", "Testing formats", "--cwd", tempDir]);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("defaults to json in non-TTY (test environment)", () => {
    test("init outputs valid JSON by default", async () => {
      const dir = await mkdtemp(join(tmpdir(), "grimoire-fmt-init-"));
      try {
        const output = run(["init", "--name", "Test", "--cwd", dir]);
        const parsed = JSON.parse(output);
        expect(parsed.success).toBe(true);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    test("overview outputs valid JSON by default", () => {
      const output = run(["overview", "--cwd", tempDir]);
      const parsed = JSON.parse(output);
      expect(parsed.title).toBe("Format Test");
    });
  });

  describe("--format json", () => {
    test("init outputs JSON", async () => {
      const dir = await mkdtemp(join(tmpdir(), "grimoire-fmt-json-"));
      try {
        const output = run(["init", "--name", "Test", "--format", "json", "--cwd", dir]);
        const parsed = JSON.parse(output);
        expect(parsed.success).toBe(true);
        expect(parsed.grimoire_dir).toBeDefined();
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    test("overview outputs JSON", () => {
      const output = run(["overview", "--format", "json", "--cwd", tempDir]);
      const parsed = JSON.parse(output);
      expect(parsed.title).toBe("Format Test");
      expect(parsed.type).toBe("overview");
    });

    test("feature list outputs JSON with documents array", () => {
      const output = run(["feature", "list", "--format", "json", "--cwd", tempDir]);
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty("documents");
      expect(Array.isArray(parsed.documents)).toBe(true);
      expect(parsed).toHaveProperty("count");
      expect(parsed).toHaveProperty("type", "feature");
    });

    test("feature create outputs JSON", () => {
      const output = run([
        "feature",
        "create",
        "--title",
        "Test Feature",
        "--format",
        "json",
        "--cwd",
        tempDir,
      ]);
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(true);
      expect(parsed.id).toBeDefined();
    });

    test("feature get outputs JSON", () => {
      const createOut = run([
        "feature",
        "create",
        "--title",
        "Get Test",
        "--format",
        "json",
        "--cwd",
        tempDir,
      ]);
      const { id } = JSON.parse(createOut);

      const output = run(["feature", "get", id, "--format", "json", "--cwd", tempDir]);
      const parsed = JSON.parse(output);
      expect(parsed.id).toBe(id);
      expect(parsed.frontmatter.title).toBe("Get Test");
    });

    test("errors output JSON to stderr", () => {
      const stderr = runErr(["feature", "delete", "nonexistent", "--format", "json"]);
      const parsed = JSON.parse(stderr);
      expect(parsed.error).toBeDefined();
    });
  });

  describe("--format cli", () => {
    test("init outputs human-readable text", async () => {
      const dir = await mkdtemp(join(tmpdir(), "grimoire-fmt-cli-"));
      try {
        const output = run(["init", "--name", "CLI Test", "--format", "cli", "--cwd", dir]);
        expect(output).toContain("Initialized grimoire in");
        expect(() => JSON.parse(output)).toThrow();
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    test("overview outputs human-readable text", () => {
      const output = run(["overview", "--format", "cli", "--cwd", tempDir]);
      expect(output).toContain("# Format Test");
      expect(() => JSON.parse(output)).toThrow();
    });

    test("feature list outputs human-readable text", () => {
      run(["feature", "create", "--title", "Alpha Feature", "--cwd", tempDir]);
      run(["feature", "create", "--title", "Beta Feature", "--cwd", tempDir]);

      const output = run(["feature", "list", "--format", "cli", "--cwd", tempDir]);
      expect(output).toContain("Alpha Feature");
      expect(output).toContain("Beta Feature");
      expect(() => JSON.parse(output)).toThrow();
    });

    test("feature list shows empty message when no documents", () => {
      const output = run(["feature", "list", "--format", "cli", "--cwd", tempDir]);
      expect(output).toContain("No feature documents found.");
    });

    test("feature create outputs human-readable text", () => {
      const output = run([
        "feature",
        "create",
        "--title",
        "CLI Feature",
        "--format",
        "cli",
        "--cwd",
        tempDir,
      ]);
      expect(output).toContain("Created feature:");
      expect(() => JSON.parse(output)).toThrow();
    });

    test("feature get outputs human-readable text", () => {
      const createOut = run([
        "feature",
        "create",
        "--title",
        "Readable Feature",
        "--format",
        "json",
        "--cwd",
        tempDir,
      ]);
      const { id } = JSON.parse(createOut);

      const output = run(["feature", "get", id, "--format", "cli", "--cwd", tempDir]);
      expect(output).toContain("Readable Feature");
      expect(output).toContain(id);
      expect(() => JSON.parse(output)).toThrow();
    });

    test("feature update outputs human-readable text", () => {
      const createOut = run([
        "feature",
        "create",
        "--title",
        "Update Me",
        "--format",
        "json",
        "--cwd",
        tempDir,
      ]);
      const { id } = JSON.parse(createOut);

      const output = run([
        "feature",
        "update",
        id,
        "--status",
        "in-progress",
        "--format",
        "cli",
        "--cwd",
        tempDir,
      ]);
      expect(output).toContain("Updated feature:");
      expect(() => JSON.parse(output)).toThrow();
    });

    test("feature delete outputs human-readable text", () => {
      const createOut = run([
        "feature",
        "create",
        "--title",
        "Delete Me",
        "--format",
        "json",
        "--cwd",
        tempDir,
      ]);
      const { id } = JSON.parse(createOut);

      const output = run([
        "feature",
        "delete",
        id,
        "--confirm",
        "--format",
        "cli",
        "--cwd",
        tempDir,
      ]);
      expect(output).toContain("Deleted feature:");
      expect(() => JSON.parse(output)).toThrow();
    });

    test("errors output plain text to stderr", () => {
      const stderr = runErr([
        "feature",
        "delete",
        "nonexistent",
        "--format",
        "cli",
        "--cwd",
        tempDir,
      ]);
      expect(stderr).toContain("Error:");
      expect(() => JSON.parse(stderr)).toThrow();
    });
  });
});
