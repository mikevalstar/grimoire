import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import {
  appendComment,
  appendLog,
  createDocument,
  deleteDocument,
  getDocument,
  init,
  listDocuments,
  resolveDocumentId,
  resolveDocumentIdAnyType,
  updateDocument,
} from "../src/index.ts";

describe("document operations", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "grimoire-core-"));
    await init({
      name: "Core Test Project",
      description: "",
      cwd: tempDir,
    });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("resolveDocumentId matches full ids, bare uids, and prefixed uids", async () => {
    const feature = await createDocument({
      type: "feature",
      title: "User Authentication",
      tags: [],
      body: "",
      cwd: tempDir,
    });

    expect(await resolveDocumentId(tempDir, "feature", feature.id)).toBe(feature.id);
    expect(await resolveDocumentId(tempDir, "feature", feature.uid)).toBe(feature.id);
    expect(await resolveDocumentId(tempDir, "feature", `feat-${feature.uid}`)).toBe(feature.id);
  });

  test("resolveDocumentIdAnyType infers type from id prefix and uid-only lookups", async () => {
    const task = await createDocument({
      type: "task",
      title: "Ship Login Form",
      tags: [],
      body: "",
      cwd: tempDir,
    });

    await expect(resolveDocumentIdAnyType(tempDir, task.id)).resolves.toMatchObject({
      type: "task",
      id: task.id,
    });
    await expect(resolveDocumentIdAnyType(tempDir, task.uid)).resolves.toMatchObject({
      type: "task",
      id: task.id,
    });
  });

  test("getDocument supports metadata-only responses", async () => {
    const feature = await createDocument({
      type: "feature",
      title: "Metadata Only",
      tags: [],
      body: "# Metadata Only\n\nBody text",
      cwd: tempDir,
    });

    const result = await getDocument({
      type: "feature",
      id: feature.id,
      metadataOnly: true,
      noChangelog: false,
      cwd: tempDir,
    });

    expect(result.frontmatter.title).toBe("Metadata Only");
    expect(result.body).toBe("");
  });

  test("getDocument strips the changelog cleanly in no-changelog mode", async () => {
    const feature = await createDocument({
      type: "feature",
      title: "Compact Body",
      tags: [],
      body: "# Compact Body\n\nUseful content",
      cwd: tempDir,
    });

    const result = await getDocument({
      type: "feature",
      id: feature.id,
      metadataOnly: false,
      noChangelog: true,
      cwd: tempDir,
    });

    expect(result.body).toContain("Useful content");
    expect(result.body).not.toContain("## Changelog");
    expect(result.body.trimEnd()).not.toMatch(/---$/);
  });

  test("listDocuments filters by tag and feature, sorts descending, and respects limit", async () => {
    const featureA = await createDocument({
      type: "feature",
      title: "Feature Alpha",
      tags: [],
      body: "",
      cwd: tempDir,
    });
    const featureB = await createDocument({
      type: "feature",
      title: "Feature Beta",
      tags: [],
      body: "",
      cwd: tempDir,
    });

    const reqOne = await createDocument({
      type: "requirement",
      title: "Requirement One",
      feature: featureA.id,
      tags: ["api"],
      body: "",
      cwd: tempDir,
    });
    const reqTwo = await createDocument({
      type: "requirement",
      title: "Requirement Two",
      feature: featureB.id,
      tags: ["api"],
      body: "",
      cwd: tempDir,
    });

    await updateDocument({
      type: "requirement",
      id: reqOne.id,
      title: "AAA Requirement One",
      addTag: [],
      removeTag: [],
      cwd: tempDir,
    });
    await updateDocument({
      type: "requirement",
      id: reqTwo.id,
      title: "ZZZ Requirement Two",
      addTag: [],
      removeTag: [],
      cwd: tempDir,
    });

    const result = await listDocuments({
      type: "requirement",
      feature: featureB.id,
      tag: "api",
      sort: "title",
      limit: 1,
      cwd: tempDir,
    });

    expect(result.count).toBe(1);
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]?.id).toBe(reqTwo.id);
  });

  test("updateDocument append inserts content before the changelog section", async () => {
    const feature = await createDocument({
      type: "feature",
      title: "Append Body",
      tags: [],
      body: "# Append Body\n\nIntro paragraph.",
      cwd: tempDir,
    });

    await updateDocument({
      type: "feature",
      id: feature.id,
      append: "Follow-up note.",
      addTag: [],
      removeTag: [],
      cwd: tempDir,
    });

    const content = await readFile(
      join(tempDir, ".grimoire/features", `${feature.id}.md`),
      "utf-8",
    );
    const appendIndex = content.indexOf("Follow-up note.");
    const changelogIndex = content.indexOf("## Changelog");

    expect(appendIndex).toBeGreaterThan(content.indexOf("Intro paragraph."));
    expect(appendIndex).toBeLessThan(changelogIndex);
  });

  test("updateDocument --body preserves existing Comments and Changelog sections", async () => {
    const feature = await createDocument({
      type: "feature",
      title: "Body Preserve",
      tags: [],
      body: "# Body Preserve\n\nOriginal content.",
      cwd: tempDir,
    });

    // Add a log entry so there's changelog content to preserve
    await appendLog({
      id: feature.id,
      message: "Initial setup done.",
      author: "agent",
      cwd: tempDir,
    });

    // Add a comment so there's comment content to preserve
    await appendComment({
      id: feature.id,
      message: "Looks good so far.",
      author: "reviewer",
      cwd: tempDir,
    });

    // Now replace the body
    await updateDocument({
      type: "feature",
      id: feature.id,
      body: "# Body Preserve\n\nReplaced content.",
      addTag: [],
      removeTag: [],
      cwd: tempDir,
    });

    const content = await readFile(
      join(tempDir, ".grimoire/features", `${feature.id}.md`),
      "utf-8",
    );

    // New body content is present
    expect(content).toContain("Replaced content.");
    expect(content).not.toContain("Original content.");

    // Comments and changelog are preserved
    expect(content).toContain("## Comments");
    expect(content).toContain("Looks good so far.");
    expect(content).toContain("## Changelog");
    expect(content).toContain("Initial setup done.");
  });

  test("updateDocument --body works when no Comments or Changelog exist", async () => {
    const feature = await createDocument({
      type: "feature",
      title: "No Sections",
      tags: [],
      body: "# No Sections\n\nOriginal.",
      cwd: tempDir,
    });

    // Strip comments and changelog from the file
    const filepath = join(tempDir, ".grimoire/features", `${feature.id}.md`);
    const original = await readFile(filepath, "utf-8");
    const stripped = original.replace(/\n---\n\n## Comments[\s\S]*$/, "");
    await writeFile(filepath, stripped);

    await updateDocument({
      type: "feature",
      id: feature.id,
      body: "# No Sections\n\nNew content.",
      addTag: [],
      removeTag: [],
      cwd: tempDir,
    });

    const content = await readFile(filepath, "utf-8");
    expect(content).toContain("New content.");
    expect(content).not.toContain("Original.");
  });

  test("updateDocument deduplicates decision features when the same feature is added twice", async () => {
    const feature = await createDocument({
      type: "feature",
      title: "Feature Link",
      tags: [],
      body: "",
      cwd: tempDir,
    });
    const decision = await createDocument({
      type: "decision",
      title: "Architecture Choice",
      feature: feature.id,
      tags: [],
      body: "",
      cwd: tempDir,
    });

    await updateDocument({
      type: "decision",
      id: decision.id,
      feature: feature.id,
      addTag: [],
      removeTag: [],
      cwd: tempDir,
    });

    const result = await getDocument({
      type: "decision",
      id: decision.id,
      metadataOnly: false,
      noChangelog: false,
      cwd: tempDir,
    });

    expect(result.frontmatter.features).toEqual([feature.id]);
  });

  test("appendLog recreates comment and changelog sections when they are missing", async () => {
    const feature = await createDocument({
      type: "feature",
      title: "Manual File",
      tags: [],
      body: "",
      cwd: tempDir,
    });
    const filepath = join(tempDir, ".grimoire/features", `${feature.id}.md`);

    await writeFile(
      filepath,
      `---
id: "${feature.id}"
uid: "${feature.uid}"
title: "Manual File"
type: "feature"
status: "proposed"
priority: "medium"
created: "2026-01-01"
updated: "2026-01-01"
tags: []
requirements: []
decisions: []
---

# Manual File

Body only.
`,
    );

    await appendLog({
      id: feature.id,
      message: "Recovered the changelog.",
      author: "agent",
      cwd: tempDir,
    });

    const content = await readFile(filepath, "utf-8");
    const today = new Date().toISOString().slice(0, 10);

    expect(content).toContain("## Comments");
    expect(content).toContain("## Changelog");
    expect(content).toContain("Recovered the changelog.");
    expect(content).toContain(`updated: "${today}"`);
  });

  test("appendComment inserts a comments section before an existing changelog", async () => {
    const feature = await createDocument({
      type: "feature",
      title: "Comment Recovery",
      tags: [],
      body: "",
      cwd: tempDir,
    });
    const filepath = join(tempDir, ".grimoire/features", `${feature.id}.md`);
    const original = await readFile(filepath, "utf-8");

    await writeFile(
      filepath,
      original.replace(/\n+---\n\n## Comments[\s\S]*?(?=\n---\n\n## Changelog)/, ""),
    );

    await appendComment({
      id: feature.id,
      message: "Please revisit the naming.",
      author: "agent",
      cwd: tempDir,
    });

    const content = await readFile(filepath, "utf-8");
    const commentsIndex = content.indexOf("## Comments");
    const changelogIndex = content.indexOf("## Changelog");
    const commentIndex = content.indexOf("> Please revisit the naming.");

    expect(commentsIndex).toBeGreaterThan(-1);
    expect(commentIndex).toBeGreaterThan(commentsIndex);
    expect(commentIndex).toBeLessThan(changelogIndex);
  });

  test("deleteDocument archives by default and hard deletes when requested", async () => {
    const archived = await createDocument({
      type: "task",
      title: "Archive Me",
      tags: [],
      body: "",
      cwd: tempDir,
    });
    const hardDeleted = await createDocument({
      type: "task",
      title: "Delete Me",
      tags: [],
      body: "",
      cwd: tempDir,
    });

    await deleteDocument({
      type: "task",
      id: archived.id,
      hard: false,
      cwd: tempDir,
    });
    await deleteDocument({
      type: "task",
      id: hardDeleted.id,
      hard: true,
      cwd: tempDir,
    });

    await expect(
      access(join(tempDir, ".grimoire/.archive/tasks", `${archived.id}.md`)),
    ).resolves.toBeUndefined();
    await expect(
      access(join(tempDir, ".grimoire/tasks", `${hardDeleted.id}.md`)),
    ).rejects.toThrow();
  });
});
