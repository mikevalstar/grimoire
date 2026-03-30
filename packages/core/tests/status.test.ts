import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { closeDatabase, createDocument, init, status, sync } from "../src/index.ts";

describe("status", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "grimoire-status-"));
    await init({
      name: "Status Test Project",
      description: "",
      cwd: tempDir,
    });
  });

  afterEach(async () => {
    closeDatabase();
    await rm(tempDir, { recursive: true, force: true });
  });

  test("returns zero counts for empty project", async () => {
    await sync({ cwd: tempDir, full: true });

    const result = await status({ cwd: tempDir });
    expect(result.counts.total).toBe(0);
    expect(result.counts.features).toBe(0);
    expect(result.open_tasks).toBe(0);
    expect(result.blocked_tasks).toBe(0);
    expect(result.orphaned_documents).toBe(0);
  });

  test("counts documents by type", async () => {
    await createDocument({ type: "feature", title: "F1", tags: [], body: "", cwd: tempDir });
    await createDocument({ type: "feature", title: "F2", tags: [], body: "", cwd: tempDir });
    await createDocument({ type: "decision", title: "D1", tags: [], body: "", cwd: tempDir });

    await sync({ cwd: tempDir, full: true });

    const result = await status({ cwd: tempDir });
    expect(result.counts.features).toBe(2);
    expect(result.counts.decisions).toBe(1);
    expect(result.counts.total).toBe(3);
  });

  test("reports status breakdown by type", async () => {
    await createDocument({ type: "feature", title: "F1", tags: [], body: "", cwd: tempDir });

    await sync({ cwd: tempDir, full: true });

    const result = await status({ cwd: tempDir });
    expect(result.by_status.feature).toBeDefined();
    expect(result.by_status.feature!.proposed).toBe(1);
  });

  test("counts open and blocked tasks", async () => {
    const feat = await createDocument({
      type: "feature",
      title: "F1",
      tags: [],
      body: "",
      cwd: tempDir,
    });
    const req = await createDocument({
      type: "requirement",
      title: "R1",
      feature: feat.id,
      tags: [],
      body: "",
      cwd: tempDir,
    });

    await createDocument({
      type: "task",
      title: "T1",
      requirement: req.id,
      tags: [],
      body: "",
      cwd: tempDir,
    });

    await sync({ cwd: tempDir, full: true });

    const result = await status({ cwd: tempDir });
    // Default task status is "todo" which counts as open
    expect(result.open_tasks).toBe(1);
    expect(result.blocked_tasks).toBe(0);
  });

  test("reports orphaned documents", async () => {
    await createDocument({ type: "feature", title: "Lonely", tags: [], body: "", cwd: tempDir });

    await sync({ cwd: tempDir, full: true });

    const result = await status({ cwd: tempDir });
    expect(result.orphaned_documents).toBe(1);
  });

  test("returns recent documents with limit", async () => {
    await createDocument({ type: "feature", title: "F1", tags: [], body: "", cwd: tempDir });
    await createDocument({ type: "feature", title: "F2", tags: [], body: "", cwd: tempDir });
    await createDocument({ type: "feature", title: "F3", tags: [], body: "", cwd: tempDir });

    await sync({ cwd: tempDir, full: true });

    const result = await status({ limit: 2, cwd: tempDir });
    expect(result.recent).toHaveLength(2);
  });

  test("recent documents include expected fields", async () => {
    await createDocument({ type: "feature", title: "F1", tags: [], body: "", cwd: tempDir });

    await sync({ cwd: tempDir, full: true });

    const result = await status({ cwd: tempDir });
    expect(result.recent[0]).toEqual(
      expect.objectContaining({
        id: expect.stringContaining("feat-"),
        title: "F1",
        type: "feature",
        status: "proposed",
        updated: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    );
  });
});
