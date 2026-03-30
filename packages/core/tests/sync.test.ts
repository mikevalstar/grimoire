import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
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

    const result = await sync({ cwd: tempDir, skipEmbeddings: true });

    expect(result.files_processed).toBe(2);
    expect(result.documents_synced).toBe(2);
    expect(result.errors.length).toBe(0);
  });

  test("syncs all document types", async () => {
    await writeOverview();
    const featId = await writeFeature("abc12", "Auth");
    await writeRequirement("def34", "Login Flow", featId);

    const result = await sync({ cwd: tempDir, skipEmbeddings: true });

    expect(result.files_processed).toBe(3);
    expect(result.documents_synced).toBe(3);
  });

  test("extracts relationships from frontmatter", async () => {
    await writeOverview();
    const reqId = `req-def34-login-flow`;
    const featId = await writeFeature("abc12", "Auth", [reqId]);
    await writeRequirement("def34", "Login Flow", featId);

    const result = await sync({ cwd: tempDir, skipEmbeddings: true });

    // feature → has_requirement → req, and req → parent_feature → feat
    expect(result.relationships_synced).toBeGreaterThanOrEqual(2);
  });

  test("extracts changelog entries", async () => {
    await writeOverview();
    const featId = await writeFeature("abc12", "Auth");
    await writeRequirement("def34", "Login Flow", featId);

    const result = await sync({ cwd: tempDir, skipEmbeddings: true });

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

    const result = await sync({ cwd: tempDir, skipEmbeddings: true });

    expect(result.documents_synced).toBe(1); // only overview
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.file.includes("malformed"))).toBe(true);
  });

  test("full rebuild clears previous data", async () => {
    await writeOverview();
    await writeFeature("abc12", "Auth");

    // First sync
    const result1 = await sync({ cwd: tempDir, skipEmbeddings: true });
    expect(result1.documents_synced).toBe(2);

    // Remove feature file and re-sync with full rebuild
    await rm(join(grimoireDir, "features", "feat-abc12-auth.md"));
    closeDatabase();
    const result2 = await sync({ cwd: tempDir, full: true, skipEmbeddings: true });

    expect(result2.documents_synced).toBe(1); // only overview remains
  });

  test("reports missing relationship targets as errors", async () => {
    await writeOverview();
    // Feature referencing a non-existent requirement
    await writeFeature("abc12", "Auth", ["req-nonexistent-missing"]);

    const result = await sync({ cwd: tempDir, skipEmbeddings: true });

    expect(result.documents_synced).toBe(2);
    expect(result.errors.some((e) => e.message.includes("target document not found"))).toBe(true);
  });

  test("returns correct JSON structure", async () => {
    await writeOverview();
    const result = await sync({ cwd: tempDir, skipEmbeddings: true });

    expect(result).toHaveProperty("files_processed");
    expect(result).toHaveProperty("documents_synced");
    expect(result).toHaveProperty("relationships_synced");
    expect(result).toHaveProperty("changelog_entries_synced");
    expect(result).toHaveProperty("errors");
    expect(result).toHaveProperty("incremental");
    expect(Array.isArray(result.errors)).toBe(true);
  });

  test("first sync is always a full rebuild", async () => {
    await writeOverview();
    const result = await sync({ cwd: tempDir, skipEmbeddings: true });

    expect(result.incremental).toBe(false);
    expect(result.documents_synced).toBe(1);
  });

  test("second sync with no changes is incremental with zero documents synced", async () => {
    await writeOverview();
    await writeFeature("abc12", "Auth");

    // First sync — full rebuild
    const result1 = await sync({ cwd: tempDir, skipEmbeddings: true });
    expect(result1.incremental).toBe(false);
    expect(result1.documents_synced).toBe(2);

    // Second sync — no changes, should be incremental
    closeDatabase();
    const result2 = await sync({ cwd: tempDir, skipEmbeddings: true });
    expect(result2.incremental).toBe(true);
    expect(result2.documents_synced).toBe(0);
    expect(result2.files_processed).toBe(0);
    expect(result2.errors.length).toBe(0);
  });

  test("incremental sync detects changed files", async () => {
    await writeOverview();
    const featId = await writeFeature("abc12", "Auth");

    // First sync
    await sync({ cwd: tempDir, skipEmbeddings: true });
    closeDatabase();

    // Modify the feature file body (replace description text)
    const featPath = join(grimoireDir, "features", `${featId}.md`);
    const original = await readFile(featPath, "utf-8");
    await writeFile(
      featPath,
      original.replace("Feature description.", "Updated feature description."),
    );

    const result = await sync({ cwd: tempDir, skipEmbeddings: true });
    expect(result.errors.length).toBe(0);
    expect(result.incremental).toBe(true);
    expect(result.documents_synced).toBe(1); // only the changed file
  });

  test("incremental sync detects new files", async () => {
    await writeOverview();

    // First sync with just overview
    await sync({ cwd: tempDir, skipEmbeddings: true });

    // Add a new feature
    closeDatabase();
    await writeFeature("xyz99", "New Feature");

    const result = await sync({ cwd: tempDir, skipEmbeddings: true });
    expect(result.incremental).toBe(true);
    expect(result.documents_synced).toBe(1); // only the new file
  });

  test("incremental sync detects deleted files", async () => {
    await writeOverview();
    await writeFeature("abc12", "Auth");

    // First sync
    await sync({ cwd: tempDir, skipEmbeddings: true });

    // Remove the feature file
    closeDatabase();
    await rm(join(grimoireDir, "features", "feat-abc12-auth.md"));

    const result = await sync({ cwd: tempDir, skipEmbeddings: true });
    expect(result.incremental).toBe(true);
    expect(result.files_processed).toBe(1); // the deleted file counts
  });

  test("full flag forces full rebuild even when hashes exist", async () => {
    await writeOverview();
    await writeFeature("abc12", "Auth");

    // First sync stores hashes
    await sync({ cwd: tempDir, skipEmbeddings: true });

    // Force full rebuild
    closeDatabase();
    const result = await sync({ cwd: tempDir, full: true, skipEmbeddings: true });
    expect(result.incremental).toBe(false);
    expect(result.documents_synced).toBe(2); // all documents re-synced
  });

  test("dry-run on first sync reports all files as adds", async () => {
    await writeOverview();
    await writeFeature("abc12", "Auth");

    const result = await sync({ cwd: tempDir, dryRun: true, skipEmbeddings: true });

    expect(result.dry_run).toBe(true);
    expect(result.incremental).toBe(false);
    expect(result.documents_synced).toBe(0);
    expect(result.changes).toBeDefined();
    expect(result.changes!.length).toBe(2);
    expect(result.changes!.every((c) => c.action === "add")).toBe(true);
  });

  test("dry-run does not write to database", async () => {
    await writeOverview();
    await writeFeature("abc12", "Auth");

    // Dry run should not create hashes
    await sync({ cwd: tempDir, dryRun: true, skipEmbeddings: true });

    // A real sync after dry-run should still be a full rebuild (no stored hashes)
    closeDatabase();
    const result = await sync({ cwd: tempDir, skipEmbeddings: true });
    expect(result.incremental).toBe(false);
    expect(result.documents_synced).toBe(2);
  });

  test("dry-run with force shows all files even when hashes exist", async () => {
    await writeOverview();
    await writeFeature("abc12", "Auth");

    // First real sync to store hashes
    await sync({ cwd: tempDir, skipEmbeddings: true });

    // Force dry-run should show all files as updates
    closeDatabase();
    const result = await sync({ cwd: tempDir, full: true, dryRun: true, skipEmbeddings: true });

    expect(result.dry_run).toBe(true);
    expect(result.incremental).toBe(false);
    expect(result.changes!.length).toBe(2);
    expect(result.changes!.every((c) => c.action === "update")).toBe(true);
  });

  test("incremental dry-run detects changes without writing", async () => {
    await writeOverview();
    const featId = await writeFeature("abc12", "Auth");

    await sync({ cwd: tempDir, skipEmbeddings: true });
    closeDatabase();

    // Modify the feature file
    const featPath = join(grimoireDir, "features", `${featId}.md`);
    const original = await readFile(featPath, "utf-8");
    await writeFile(featPath, original.replace("Feature description.", "Updated."));

    const result = await sync({ cwd: tempDir, dryRun: true, skipEmbeddings: true });

    expect(result.dry_run).toBe(true);
    expect(result.incremental).toBe(true);
    expect(result.changes!.length).toBe(1);
    expect(result.changes![0]!.action).toBe("update");
    expect(result.changes![0]!.filepath).toContain("feat-abc12-auth");
  });

  test("incremental dry-run with no changes reports empty", async () => {
    await writeOverview();
    await writeFeature("abc12", "Auth");

    await sync({ cwd: tempDir, skipEmbeddings: true });
    closeDatabase();

    const result = await sync({ cwd: tempDir, dryRun: true, skipEmbeddings: true });

    expect(result.dry_run).toBe(true);
    expect(result.incremental).toBe(true);
    expect(result.changes!.length).toBe(0);
  });

  test("incremental sync preserves relationships across unchanged documents", async () => {
    await writeOverview();
    const reqId = "req-def34-login-flow";
    const featId = await writeFeature("abc12", "Auth", [reqId]);
    await writeRequirement("def34", "Login Flow", featId);

    // First sync
    await sync({ cwd: tempDir, skipEmbeddings: true });

    // No changes — relationships should still be intact
    closeDatabase();
    const result = await sync({ cwd: tempDir, skipEmbeddings: true });
    expect(result.incremental).toBe(true);
    expect(result.relationships_synced).toBeGreaterThanOrEqual(2);
  });
});
