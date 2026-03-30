import { mkdir, writeFile, rm } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { closeDatabase, sync } from "../src/index.ts";

describe("sync", () => {
  let tempDir: string;
  let grimoireDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "grimoire-sync-"));
    grimoireDir = join(tempDir, ".grimoire");
    await mkdir(join(grimoireDir, "features"), { recursive: true });
    await mkdir(join(grimoireDir, "requirements"), { recursive: true });
    await mkdir(join(grimoireDir, "tasks"), { recursive: true });
    await mkdir(join(grimoireDir, "decisions"), { recursive: true });
    await mkdir(join(grimoireDir, ".cache"), { recursive: true });
  });

  afterEach(() => {
    closeDatabase();
    return rm(tempDir, { recursive: true, force: true });
  });

  async function writeOverview() {
    await writeFile(
      join(grimoireDir, "overview.md"),
      `---
id: overview
title: Test Project
description: A test project
type: overview
version: 1
created: "2026-03-29"
updated: "2026-03-29"
tags: [test]
---

# Test Project

This is a test project.

---

## Comments

---

## Changelog

### 2026-03-29 10:00 | grimoire
Document created.
`,
    );
  }

  async function writeFeature(uid: string, title: string, requirements: string[] = []) {
    const slug = title.toLowerCase().replace(/\s+/g, "-");
    const reqYaml =
      requirements.length > 0
        ? `requirements:\n${requirements.map((r) => `  - ${r}`).join("\n")}`
        : "requirements: []";
    await writeFile(
      join(grimoireDir, "features", `feat-${uid}-${slug}.md`),
      `---
id: "feat-${uid}-${slug}"
uid: "${uid}"
title: "${title}"
type: feature
status: in-progress
priority: high
created: "2026-03-29"
updated: "2026-03-29"
tags: [core]
${reqYaml}
decisions: []
---

# ${title}

Feature description.

---

## Comments

---

## Changelog

### 2026-03-29 10:00 | grimoire
Document created.
`,
    );
    return `feat-${uid}-${slug}`;
  }

  async function writeRequirement(uid: string, title: string, featureId: string) {
    const slug = title.toLowerCase().replace(/\s+/g, "-");
    await writeFile(
      join(grimoireDir, "requirements", `req-${uid}-${slug}.md`),
      `---
id: "req-${uid}-${slug}"
uid: "${uid}"
title: "${title}"
type: requirement
status: draft
priority: medium
feature: "${featureId}"
created: "2026-03-29"
updated: "2026-03-29"
tags: [sync]
tasks: []
depends_on: []
---

# ${title}

Requirement description.

---

## Comments

### 2026-03-29 11:00 | alice
> Is this requirement complete?

---

## Changelog

### 2026-03-29 10:00 | grimoire
Document created.

### 2026-03-29 12:00 | bob
Updated acceptance criteria.
`,
    );
    return `req-${uid}-${slug}`;
  }

  test("syncs overview and documents into database", async () => {
    await writeOverview();
    await writeFeature("abc12", "User Auth");

    const result = await sync({ cwd: tempDir });

    expect(result.files_processed).toBe(2);
    expect(result.documents_synced).toBe(2);
    expect(result.errors.length).toBe(0);
  });

  test("syncs all document types", async () => {
    await writeOverview();
    const featId = await writeFeature("abc12", "Auth");
    await writeRequirement("def34", "Login Flow", featId);

    const result = await sync({ cwd: tempDir });

    expect(result.files_processed).toBe(3);
    expect(result.documents_synced).toBe(3);
  });

  test("extracts relationships from frontmatter", async () => {
    await writeOverview();
    const reqId = `req-def34-login-flow`;
    const featId = await writeFeature("abc12", "Auth", [reqId]);
    await writeRequirement("def34", "Login Flow", featId);

    const result = await sync({ cwd: tempDir });

    // feature → has_requirement → req, and req → parent_feature → feat
    expect(result.relationships_synced).toBeGreaterThanOrEqual(2);
  });

  test("extracts changelog entries", async () => {
    await writeOverview();
    const featId = await writeFeature("abc12", "Auth");
    await writeRequirement("def34", "Login Flow", featId);

    const result = await sync({ cwd: tempDir });

    // overview: 1 changelog, feature: 1 changelog, requirement: 1 comment + 2 changelogs
    expect(result.changelog_entries_synced).toBeGreaterThanOrEqual(4);
  });

  test("handles malformed files gracefully", async () => {
    await writeOverview();

    // Write a malformed feature file
    await writeFile(
      join(grimoireDir, "features", "feat-bad-malformed.md"),
      "This is not valid frontmatter at all",
    );

    const result = await sync({ cwd: tempDir });

    expect(result.documents_synced).toBe(1); // only overview
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.file.includes("malformed"))).toBe(true);
  });

  test("full rebuild clears previous data", async () => {
    await writeOverview();
    await writeFeature("abc12", "Auth");

    // First sync
    const result1 = await sync({ cwd: tempDir });
    expect(result1.documents_synced).toBe(2);

    // Remove feature file and re-sync
    await rm(join(grimoireDir, "features", "feat-abc12-auth.md"));
    const result2 = await sync({ cwd: tempDir });

    expect(result2.documents_synced).toBe(1); // only overview remains
  });

  test("reports missing relationship targets as errors", async () => {
    await writeOverview();
    // Feature referencing a non-existent requirement
    await writeFeature("abc12", "Auth", ["req-nonexistent-missing"]);

    const result = await sync({ cwd: tempDir });

    expect(result.documents_synced).toBe(2);
    expect(result.errors.some((e) => e.message.includes("target document not found"))).toBe(true);
  });

  test("returns correct JSON structure", async () => {
    await writeOverview();
    const result = await sync({ cwd: tempDir });

    expect(result).toHaveProperty("files_processed");
    expect(result).toHaveProperty("documents_synced");
    expect(result).toHaveProperty("relationships_synced");
    expect(result).toHaveProperty("changelog_entries_synced");
    expect(result).toHaveProperty("errors");
    expect(Array.isArray(result.errors)).toBe(true);
  });
});
