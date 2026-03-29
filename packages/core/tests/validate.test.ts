import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { createDocument, init, validate } from "../src/index.ts";

describe("validate", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "grimoire-validate-"));
    await init({
      name: "Validate Test Project",
      description: "",
      cwd: tempDir,
      skipSkills: true,
    });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("valid project with no documents reports no errors", async () => {
    const result = await validate({ cwd: tempDir });
    expect(result.valid).toBe(true);
    expect(result.errors).toBe(0);
  });

  test("valid project with linked documents reports no errors", async () => {
    const feature = await createDocument({
      type: "feature",
      title: "Auth Feature",
      tags: [],
      body: "",
      cwd: tempDir,
    });

    await createDocument({
      type: "requirement",
      title: "OAuth Flow",
      feature: feature.id,
      tags: [],
      body: "",
      cwd: tempDir,
    });

    const result = await validate({ cwd: tempDir });
    expect(result.valid).toBe(true);
    expect(result.errors).toBe(0);
  });

  test("detects missing overview.md", async () => {
    const overviewPath = join(tempDir, ".grimoire", "overview.md");
    await rm(overviewPath);

    const result = await validate({ cwd: tempDir });
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        type: "missing_overview",
      }),
    );
  });

  test("detects broken link in requirement.feature", async () => {
    // Create a requirement that references a non-existent feature
    const reqDir = join(tempDir, ".grimoire", "requirements");
    await mkdir(reqDir, { recursive: true });
    await writeFile(
      join(reqDir, "req-abc12-test.md"),
      `---
id: "req-abc12-test"
uid: "abc12"
title: "Test Req"
type: "requirement"
status: "draft"
priority: "medium"
feature: "feat-zzzzz-nonexistent"
created: "2026-01-01"
updated: "2026-01-01"
tags: []
tasks: []
depends_on: []
---

# Test Req
`,
    );

    const result = await validate({ cwd: tempDir });
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        type: "broken_link",
        document: "req-abc12-test",
        field: "feature",
      }),
    );
  });

  test("detects broken link in feature.requirements array", async () => {
    const featDir = join(tempDir, ".grimoire", "features");
    await mkdir(featDir, { recursive: true });
    await writeFile(
      join(featDir, "feat-abc12-test.md"),
      `---
id: "feat-abc12-test"
uid: "abc12"
title: "Test Feature"
type: "feature"
status: "proposed"
priority: "medium"
created: "2026-01-01"
updated: "2026-01-01"
tags: []
requirements:
  - req-zzzzz-gone
decisions: []
---

# Test Feature
`,
    );

    const result = await validate({ cwd: tempDir });
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        type: "broken_link",
        field: "requirements",
      }),
    );
  });

  test("detects id/filename mismatch", async () => {
    const featDir = join(tempDir, ".grimoire", "features");
    await mkdir(featDir, { recursive: true });
    await writeFile(
      join(featDir, "feat-abc12-wrong-name.md"),
      `---
id: "feat-abc12-actual-name"
uid: "abc12"
title: "Mismatched"
type: "feature"
status: "proposed"
priority: "medium"
created: "2026-01-01"
updated: "2026-01-01"
tags: []
requirements: []
decisions: []
---

# Mismatched
`,
    );

    const result = await validate({ cwd: tempDir });
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        type: "id_mismatch",
      }),
    );
  });

  test("detects orphaned documents as warnings", async () => {
    await createDocument({
      type: "feature",
      title: "Lonely Feature",
      tags: [],
      body: "",
      cwd: tempDir,
    });

    const result = await validate({ cwd: tempDir });
    // Orphans are warnings, not errors
    expect(result.valid).toBe(true);
    expect(result.warnings).toBeGreaterThan(0);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        type: "orphan",
      }),
    );
  });

  test("detects schema validation errors", async () => {
    const featDir = join(tempDir, ".grimoire", "features");
    await mkdir(featDir, { recursive: true });
    await writeFile(
      join(featDir, "feat-abc12-bad.md"),
      `---
id: "feat-abc12-bad"
uid: "abc12"
title: "Bad Status"
type: "feature"
status: "invalid-status"
priority: "medium"
created: "2026-01-01"
updated: "2026-01-01"
tags: []
requirements: []
decisions: []
---

# Bad Status
`,
    );

    const result = await validate({ cwd: tempDir });
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        type: "schema",
        document: "feat-abc12-bad",
      }),
    );
  });

  test("throws when no .grimoire/ directory exists", async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), "grimoire-empty-"));
    try {
      await expect(validate({ cwd: emptyDir })).rejects.toThrow("No .grimoire/ directory found");
    } finally {
      await rm(emptyDir, { recursive: true, force: true });
    }
  });
});
