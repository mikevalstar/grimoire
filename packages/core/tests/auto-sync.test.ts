import { mkdir, writeFile, rm } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { autoSync, closeDatabase, sync } from "../src/index.ts";

describe("autoSync", () => {
  let tempDir: string;
  let grimoireDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "grimoire-autosync-"));
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

  async function writeFeature(uid: string, title: string) {
    const slug = title.toLowerCase().replace(/\s+/g, "-");
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
requirements: []
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
  }

  test("runs sync when no prior sync exists", async () => {
    await writeOverview();

    const result = await autoSync(tempDir);

    expect(result.enabled).toBe(true);
    expect(result.synced).toBe(true);
    expect(result.result).toBeDefined();
    expect(result.result!.documents_synced).toBe(1);
  });

  test("skips sync when no files changed", async () => {
    await writeOverview();

    // Initial sync
    await sync({ cwd: tempDir });
    closeDatabase();

    // Wait briefly to ensure mtime is before last_sync_at
    await new Promise((r) => setTimeout(r, 50));

    const result = await autoSync(tempDir);

    expect(result.enabled).toBe(true);
    expect(result.synced).toBe(false);
    expect(result.result).toBeUndefined();
  });

  test("triggers sync when files changed after last sync", async () => {
    await writeOverview();

    // Initial sync
    await sync({ cwd: tempDir });
    closeDatabase();

    // Wait then add a new file
    await new Promise((r) => setTimeout(r, 50));
    await writeFeature("abc12", "New Feature");

    const result = await autoSync(tempDir);

    expect(result.enabled).toBe(true);
    expect(result.synced).toBe(true);
    expect(result.result).toBeDefined();
    expect(result.result!.incremental).toBe(true);
  });

  test("respects auto_sync: false in config", async () => {
    await writeOverview();
    await writeFile(join(grimoireDir, "config.yaml"), `sync:\n  auto_sync: false\n`);

    const result = await autoSync(tempDir);

    expect(result.enabled).toBe(false);
    expect(result.synced).toBe(false);
  });

  test("reports sync errors as warnings", async () => {
    await writeOverview();
    // Write a malformed feature
    await writeFile(join(grimoireDir, "features", "feat-bad-broken.md"), "not valid frontmatter");

    const result = await autoSync(tempDir);

    expect(result.enabled).toBe(true);
    expect(result.synced).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
