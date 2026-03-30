/**
 * Embedding cache — maps content hashes to embedding vectors.
 * Stored at .grimoire/.cache/embeddings.json so embeddings survive DuckDB rebuilds.
 * Gitignored (lives in .cache/).
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const GRIMOIRE_DIR = ".grimoire";
const CACHE_DIR = ".cache";
const CACHE_FILENAME = "embeddings.json";

interface EmbeddingCacheData {
  [contentHash: string]: number[];
}

export interface EmbeddingCache {
  get(contentHash: string): number[] | undefined;
  set(contentHash: string, embedding: number[]): void;
  has(contentHash: string): boolean;
  save(): Promise<void>;
  size: number;
}

/**
 * Load the embedding cache from disk.
 * Returns an empty cache if the file doesn't exist or is malformed.
 */
export async function loadEmbeddingCache(cwd: string = process.cwd()): Promise<EmbeddingCache> {
  const cacheDir = join(cwd, GRIMOIRE_DIR, CACHE_DIR);
  const cachePath = join(cacheDir, CACHE_FILENAME);

  let data: EmbeddingCacheData = {};

  try {
    const content = await readFile(cachePath, "utf-8");
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      data = parsed as EmbeddingCacheData;
    }
  } catch {
    // File doesn't exist or is malformed — start fresh
  }

  return {
    get(contentHash: string): number[] | undefined {
      return data[contentHash];
    },

    set(contentHash: string, embedding: number[]): void {
      data[contentHash] = embedding;
    },

    has(contentHash: string): boolean {
      return contentHash in data;
    },

    get size(): number {
      return Object.keys(data).length;
    },

    async save(): Promise<void> {
      await mkdir(cacheDir, { recursive: true });
      await writeFile(cachePath, JSON.stringify(data), "utf-8");
    },
  };
}
