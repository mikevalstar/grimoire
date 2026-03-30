import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { closeDatabase, createDocument, init, sync, tree } from "../src/index.ts";

describe("tree", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "grimoire-tree-"));
    await init({
      name: "Tree Test Project",
      description: "",
      cwd: tempDir,
    });
  });

  afterEach(async () => {
    closeDatabase();
    await rm(tempDir, { recursive: true, force: true });
  });

  test("returns empty tree when no documents exist", async () => {
    await sync({ cwd: tempDir, full: true, skipEmbeddings: true });

    const result = await tree({ cwd: tempDir });
    expect(result.tree).toEqual([]);
    expect(result.count).toBe(0);
  });

  test("builds feature → requirement → task hierarchy", async () => {
    const feature = await createDocument({
      type: "feature",
      title: "Auth",
      tags: [],
      body: "",
      cwd: tempDir,
    });

    const req = await createDocument({
      type: "requirement",
      title: "OAuth Flow",
      feature: feature.id,
      tags: [],
      body: "",
      cwd: tempDir,
    });

    await createDocument({
      type: "task",
      title: "Implement OAuth",
      requirement: req.id,
      tags: [],
      body: "",
      cwd: tempDir,
    });

    await sync({ cwd: tempDir, full: true, skipEmbeddings: true });

    const result = await tree({ cwd: tempDir });
    expect(result.count).toBe(3);
    expect(result.tree).toHaveLength(1);

    const root = result.tree[0]!;
    expect(root.type).toBe("feature");
    expect(root.children).toHaveLength(1);
    expect(root.children[0]!.type).toBe("requirement");
    expect(root.children[0]!.children).toHaveLength(1);
    expect(root.children[0]!.children[0]!.type).toBe("task");
  });

  test("filters by feature", async () => {
    const feat1 = await createDocument({
      type: "feature",
      title: "Auth",
      tags: [],
      body: "",
      cwd: tempDir,
    });

    await createDocument({
      type: "feature",
      title: "Search",
      tags: [],
      body: "",
      cwd: tempDir,
    });

    await createDocument({
      type: "requirement",
      title: "OAuth Flow",
      feature: feat1.id,
      tags: [],
      body: "",
      cwd: tempDir,
    });

    await sync({ cwd: tempDir, full: true, skipEmbeddings: true });

    const result = await tree({ feature: feat1.id, cwd: tempDir });
    expect(result.tree).toHaveLength(1);
    expect(result.tree[0]!.id).toBe(feat1.id);
    expect(result.tree[0]!.children).toHaveLength(1);
  });

  test("throws for nonexistent feature filter", async () => {
    await sync({ cwd: tempDir, full: true, skipEmbeddings: true });

    await expect(tree({ feature: "feat-zzzzz-nope", cwd: tempDir })).rejects.toThrow(
      "Feature not found",
    );
  });

  test("parentless documents appear at root level", async () => {
    await createDocument({
      type: "requirement",
      title: "Orphan Req",
      tags: [],
      body: "",
      cwd: tempDir,
    });

    await sync({ cwd: tempDir, full: true, skipEmbeddings: true });

    const result = await tree({ cwd: tempDir });
    expect(result.count).toBe(1);
    expect(result.tree[0]!.type).toBe("requirement");
  });

  test("filters by status", async () => {
    await createDocument({
      type: "feature",
      title: "Active Feature",
      tags: [],
      body: "",
      cwd: tempDir,
    });

    await sync({ cwd: tempDir, full: true, skipEmbeddings: true });

    // Default status for features is "proposed"
    const result = await tree({ status: "proposed", cwd: tempDir });
    expect(result.count).toBe(1);

    const noMatch = await tree({ status: "complete", cwd: tempDir });
    expect(noMatch.count).toBe(0);
  });
});
