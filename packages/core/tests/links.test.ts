import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { closeDatabase, createDocument, init, links, sync } from "../src/index.ts";

describe("links", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "grimoire-links-"));
    await init({
      name: "Links Test Project",
      description: "",
      cwd: tempDir,
    });
  });

  afterEach(async () => {
    closeDatabase();
    await rm(tempDir, { recursive: true, force: true });
  });

  test("returns empty links for document with no relationships", async () => {
    const feature = await createDocument({
      type: "feature",
      title: "Lonely Feature",
      tags: [],
      body: "",
      cwd: tempDir,
    });

    await sync({ cwd: tempDir, full: true, skipEmbeddings: true });

    const result = await links({ id: feature.id, cwd: tempDir });
    expect(result.id).toBe(feature.id);
    expect(result.links).toEqual([]);
    expect(result.count).toBe(0);
  });

  test("throws for nonexistent document", async () => {
    await sync({ cwd: tempDir, full: true, skipEmbeddings: true });

    await expect(links({ id: "feat-zzzzz-nope", cwd: tempDir })).rejects.toThrow(
      "Document not found",
    );
  });

  test("finds outbound and inbound links", async () => {
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

    await sync({ cwd: tempDir, full: true, skipEmbeddings: true });

    // From the requirement's perspective: outbound parent_feature link
    const reqLinks = await links({ id: req.id, cwd: tempDir });
    expect(reqLinks.count).toBeGreaterThan(0);
    expect(reqLinks.links).toContainEqual(
      expect.objectContaining({
        id: feature.id,
        relationship: "parent_feature",
        direction: "out",
        depth: 1,
      }),
    );

    // From the feature's perspective: inbound parent_feature link
    const featLinks = await links({ id: feature.id, cwd: tempDir });
    expect(featLinks.count).toBeGreaterThan(0);
    expect(featLinks.links).toContainEqual(
      expect.objectContaining({
        id: req.id,
        relationship: "parent_feature",
        direction: "in",
        depth: 1,
      }),
    );
  });

  test("filters by direction", async () => {
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

    // Feature has only inbound links (requirement points to it)
    const outOnly = await links({ id: feature.id, direction: "out", cwd: tempDir });
    expect(outOnly.count).toBe(0);

    const inOnly = await links({ id: feature.id, direction: "in", cwd: tempDir });
    expect(inOnly.count).toBeGreaterThan(0);
  });

  test("filters by relationship type", async () => {
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

    const parentLinks = await links({
      id: feature.id,
      type: "parent_feature",
      cwd: tempDir,
    });
    expect(parentLinks.count).toBeGreaterThan(0);

    const taskLinks = await links({
      id: feature.id,
      type: "has_task",
      cwd: tempDir,
    });
    expect(taskLinks.count).toBe(0);
  });

  test("traverses at depth > 1", async () => {
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

    // Depth 1 from feature: only the requirement (inbound parent_feature)
    const depth1 = await links({ id: feature.id, depth: 1, cwd: tempDir });
    const depth1Ids = depth1.links.map((l) => l.id);

    // Depth 2 from feature: should also include the task
    const depth2 = await links({ id: feature.id, depth: 2, cwd: tempDir });
    expect(depth2.count).toBeGreaterThan(depth1.count);

    const depth2Items = depth2.links.filter((l) => l.depth === 2);
    expect(depth2Items.length).toBeGreaterThan(0);

    // Items from depth 1 should not appear in depth1Ids check for depth 2
    for (const item of depth2Items) {
      expect(depth1Ids).not.toContain(item.id);
    }
  });
});
