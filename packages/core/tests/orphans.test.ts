import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { closeDatabase, createDocument, init, orphans, sync } from "../src/index.ts";

describe("orphans", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "grimoire-orphans-"));
    await init({
      name: "Orphans Test Project",
      description: "",
      cwd: tempDir,
    });
  });

  afterEach(async () => {
    closeDatabase();
    await rm(tempDir, { recursive: true, force: true });
  });

  test("returns no orphans when all documents are linked", async () => {
    const feature = await createDocument({
      type: "feature",
      title: "Auth",
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

    await sync({ cwd: tempDir, full: true, skipEmbeddings: true });

    const result = await orphans({ cwd: tempDir });
    expect(result.count).toBe(0);
    expect(result.orphans).toEqual([]);
  });

  test("detects orphaned documents", async () => {
    await createDocument({
      type: "feature",
      title: "Lonely Feature",
      tags: [],
      body: "",
      cwd: tempDir,
    });

    await sync({ cwd: tempDir, full: true, skipEmbeddings: true });

    const result = await orphans({ cwd: tempDir });
    expect(result.count).toBe(1);
    expect(result.orphans[0]!.title).toBe("Lonely Feature");
    expect(result.orphans[0]!.type).toBe("feature");
  });

  test("excludes overview from orphan detection", async () => {
    // Only overview exists — should report no orphans
    await sync({ cwd: tempDir, full: true, skipEmbeddings: true });

    const result = await orphans({ cwd: tempDir });
    expect(result.count).toBe(0);
  });

  test("filters by document type", async () => {
    await createDocument({
      type: "feature",
      title: "Lonely Feature",
      tags: [],
      body: "",
      cwd: tempDir,
    });

    await createDocument({
      type: "decision",
      title: "Lonely Decision",
      tags: [],
      body: "",
      cwd: tempDir,
    });

    await sync({ cwd: tempDir, full: true, skipEmbeddings: true });

    const featureOrphans = await orphans({ type: "feature", cwd: tempDir });
    expect(featureOrphans.count).toBe(1);
    expect(featureOrphans.orphans[0]!.type).toBe("feature");

    const decisionOrphans = await orphans({ type: "decision", cwd: tempDir });
    expect(decisionOrphans.count).toBe(1);
    expect(decisionOrphans.orphans[0]!.type).toBe("decision");

    const reqOrphans = await orphans({ type: "requirement", cwd: tempDir });
    expect(reqOrphans.count).toBe(0);
  });

  test("returns orphan details including filepath", async () => {
    await createDocument({
      type: "feature",
      title: "Lonely Feature",
      tags: [],
      body: "",
      cwd: tempDir,
    });

    await sync({ cwd: tempDir, full: true, skipEmbeddings: true });

    const result = await orphans({ cwd: tempDir });
    expect(result.orphans[0]).toEqual(
      expect.objectContaining({
        type: "feature",
        title: "Lonely Feature",
        filepath: expect.stringContaining("features/"),
      }),
    );
  });
});
