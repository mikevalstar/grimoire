import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { closeDatabase, getDatabase, sync, loadEmbeddingCache } from "../src/index.ts";

/**
 * Mock @huggingface/transformers to avoid downloading a 270MB model in tests.
 * Returns deterministic fake embeddings derived from input text length.
 */
vi.mock("@huggingface/transformers", () => ({
  pipeline: vi.fn().mockResolvedValue(
    // Mock feature-extraction pipeline: returns a tensor-like object
    vi.fn().mockImplementation((text: string) => {
      // Generate a deterministic 768-dim vector based on text length
      const dim = 768;
      const seed = text.length;
      const data = new Float32Array(dim);
      for (let i = 0; i < dim; i++) {
        data[i] = Math.sin(seed + i) * 0.1;
      }
      // Normalize
      let norm = 0;
      for (let i = 0; i < dim; i++) norm += data[i]! * data[i]!;
      norm = Math.sqrt(norm);
      for (let i = 0; i < dim; i++) data[i] /= norm;
      return { data };
    }),
  ),
}));

describe("embeddings", () => {
  let tempDir: string;
  let grimoireDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "grimoire-embed-"));
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

This is a test project overview.

---

## Comments

---

## Changelog
`,
    );
  }

  async function writeFeature(uid: string, title: string, body: string) {
    await writeFile(
      join(grimoireDir, `features/feat-${uid}-${title.toLowerCase().replace(/\s+/g, "-")}.md`),
      `---
id: "feat-${uid}-${title.toLowerCase().replace(/\s+/g, "-")}"
uid: "${uid}"
title: "${title}"
type: feature
status: proposed
priority: high
created: "2026-03-29"
updated: "2026-03-29"
tags: [test]
requirements: []
decisions: []
---

# ${title}

${body}

---

## Comments

---

## Changelog
`,
    );
  }

  test("sync generates embeddings and stores them in the database", async () => {
    await writeOverview();
    await writeFeature("abc12", "Search Feature", "Full-text and semantic search capabilities");

    const result = await sync({ cwd: tempDir });

    expect(result.errors).toEqual([]);
    expect(result.documents_synced).toBe(2);

    // Check that embeddings were stored
    const connection = await getDatabase(tempDir);
    const rows = (
      await connection.runAndReadAll(
        "SELECT id, embedding FROM documents WHERE embedding IS NOT NULL",
      )
    ).getRows();

    expect(rows.length).toBe(2);

    // Embedding should be a 768-element array-like
    for (const row of rows) {
      const embedding = row[1] as { items: number[] };
      expect(embedding.items).toHaveLength(768);
      // Values should be finite numbers
      expect(embedding.items.every((v) => Number.isFinite(v))).toBe(true);
    }
  });

  test("sync creates embedding cache file", async () => {
    await writeOverview();
    await writeFeature("def34", "Cache Test", "Testing embedding cache");

    await sync({ cwd: tempDir });

    // Cache file should exist
    const cachePath = join(grimoireDir, ".cache", "embeddings.json");
    const cacheContent = await readFile(cachePath, "utf-8");
    const cache = JSON.parse(cacheContent);

    // Should have entries for both documents
    const keys = Object.keys(cache);
    expect(keys.length).toBe(2);

    // Each cached value should be a 768-element array
    for (const key of keys) {
      expect(cache[key]).toHaveLength(768);
    }
  });

  test("incremental sync uses embedding cache for unchanged documents", async () => {
    await writeOverview();
    await writeFeature("ghi56", "Cached Feature", "This should be cached");

    // First sync generates embeddings
    await sync({ cwd: tempDir });

    // Second sync (incremental, no changes) should not regenerate
    const result2 = await sync({ cwd: tempDir });
    expect(result2.incremental).toBe(true);
    expect(result2.files_processed).toBe(0); // nothing changed
    expect(result2.errors).toEqual([]);

    // Embeddings should still be present
    const connection = await getDatabase(tempDir);
    const rows = (
      await connection.runAndReadAll("SELECT COUNT(*) FROM documents WHERE embedding IS NOT NULL")
    ).getRows();
    expect(rows[0]![0]).toBe(2n);
  });

  test("incremental sync regenerates embedding for changed document", async () => {
    await writeOverview();
    await writeFeature("jkl78", "Changing Feature", "Original content");

    await sync({ cwd: tempDir });

    // Load cache to check the hash
    const cache1 = await loadEmbeddingCache(tempDir);
    const size1 = cache1.size;
    expect(size1).toBe(2);

    // Modify the feature
    await writeFeature("jkl78", "Changing Feature", "Updated content with new information");

    const result2 = await sync({ cwd: tempDir });
    expect(result2.incremental).toBe(true);
    expect(result2.files_processed).toBe(1); // only the changed file
    expect(result2.errors).toEqual([]);

    // Cache should have a new entry (old hash + new hash)
    const cache2 = await loadEmbeddingCache(tempDir);
    expect(cache2.size).toBe(3); // 2 original + 1 new hash
  });

  test("skipEmbeddings leaves embedding column null", async () => {
    await writeOverview();
    await writeFeature("mno90", "No Embed", "This should not get an embedding");

    const result = await sync({ cwd: tempDir, skipEmbeddings: true });

    expect(result.errors).toEqual([]);

    const connection = await getDatabase(tempDir);
    const rows = (
      await connection.runAndReadAll("SELECT COUNT(*) FROM documents WHERE embedding IS NOT NULL")
    ).getRows();
    expect(rows[0]![0]).toBe(0n);
  });

  test("full sync with force regenerates all embeddings", async () => {
    await writeOverview();
    await writeFeature("pqr12", "Force Sync", "Testing full rebuild");

    // First sync
    await sync({ cwd: tempDir });

    // Full rebuild
    const result = await sync({ cwd: tempDir, full: true });
    expect(result.incremental).toBe(false);
    expect(result.errors).toEqual([]);

    // Embeddings should still be present
    const connection = await getDatabase(tempDir);
    const rows = (
      await connection.runAndReadAll("SELECT COUNT(*) FROM documents WHERE embedding IS NOT NULL")
    ).getRows();
    expect(rows[0]![0]).toBe(2n);
  });
});

describe("embedding cache", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "grimoire-cache-"));
    await mkdir(join(tempDir, ".grimoire", ".cache"), { recursive: true });
  });

  afterEach(() => rm(tempDir, { recursive: true, force: true }));

  test("loads empty cache when file does not exist", async () => {
    const cache = await loadEmbeddingCache(tempDir);
    expect(cache.size).toBe(0);
    expect(cache.has("nonexistent")).toBe(false);
    expect(cache.get("nonexistent")).toBeUndefined();
  });

  test("set and get round-trips correctly", async () => {
    const cache = await loadEmbeddingCache(tempDir);
    const vector = Array.from({ length: 768 }, (_, i) => Math.sin(i));

    cache.set("hash123", vector);
    expect(cache.has("hash123")).toBe(true);
    expect(cache.get("hash123")).toEqual(vector);
    expect(cache.size).toBe(1);
  });

  test("save and reload preserves cache", async () => {
    const cache1 = await loadEmbeddingCache(tempDir);
    const vector = Array.from({ length: 768 }, (_, i) => Math.cos(i));

    cache1.set("hashABC", vector);
    await cache1.save();

    // Reload from disk
    const cache2 = await loadEmbeddingCache(tempDir);
    expect(cache2.has("hashABC")).toBe(true);
    expect(cache2.get("hashABC")).toEqual(vector);
    expect(cache2.size).toBe(1);
  });

  test("handles malformed cache file gracefully", async () => {
    await writeFile(join(tempDir, ".grimoire", ".cache", "embeddings.json"), "not valid json!!!");

    const cache = await loadEmbeddingCache(tempDir);
    expect(cache.size).toBe(0);
  });
});
