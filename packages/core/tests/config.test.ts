import { mkdir, writeFile, rm } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { loadConfig } from "../src/index.ts";

describe("loadConfig", () => {
  let tempDir: string;
  let grimoireDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "grimoire-config-"));
    grimoireDir = join(tempDir, ".grimoire");
    await mkdir(grimoireDir, { recursive: true });
  });

  afterEach(() => rm(tempDir, { recursive: true, force: true }));

  test("returns defaults when config.yaml is missing", async () => {
    const config = await loadConfig(tempDir);

    expect(config.sync.auto_sync).toBe(true);
    expect(config.sync.watch).toBe(false);
  });

  test("reads auto_sync from config.yaml", async () => {
    await writeFile(
      join(grimoireDir, "config.yaml"),
      `sync:\n  auto_sync: false\n  watch: false\n`,
    );

    const config = await loadConfig(tempDir);
    expect(config.sync.auto_sync).toBe(false);
  });

  test("defaults missing sync fields", async () => {
    await writeFile(join(grimoireDir, "config.yaml"), `project:\n  name: test\n`);

    const config = await loadConfig(tempDir);
    expect(config.sync.auto_sync).toBe(true);
    expect(config.sync.watch).toBe(false);
  });

  test("handles malformed yaml gracefully", async () => {
    await writeFile(join(grimoireDir, "config.yaml"), `{{{invalid yaml`);

    const config = await loadConfig(tempDir);
    expect(config.sync.auto_sync).toBe(true);
  });
});
