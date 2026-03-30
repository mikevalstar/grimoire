import { execFileSync } from "node:child_process";
import { access, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";

const cli = resolve(import.meta.dirname, "../dist/index.mjs");
const coreDist = resolve(import.meta.dirname, "../../../packages/core/dist/index.mjs");
const coreDistUrl = pathToFileURL(coreDist).href;
const getDatabasePath = (cwd: string) => join(cwd, ".grimoire", ".cache", "grimoire.duckdb");

function run(args: string[]): string {
  return execFileSync("node", [cli, ...args], {
    encoding: "utf-8",
  }).trim();
}

function runJson<T>(args: string[]): T {
  return JSON.parse(run(args)) as T;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function pauseForMtimeTick(): Promise<void> {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
}

function queryRows(cwd: string, sql: string): Array<Array<string | number | null>> {
  const output = execFileSync(
    "node",
    [
      "--input-type=module",
      "-e",
      `
        import { getDatabase, closeDatabase } from ${JSON.stringify(coreDistUrl)};

        const connection = await getDatabase(${JSON.stringify(cwd)});
        try {
          const result = await connection.runAndReadAll(${JSON.stringify(sql)});
          const rows = result.getRows().map((row) =>
            row.map((value) => {
              if (value === null || value === undefined) return null;
              if (value instanceof Date) return value.toISOString();
              if (typeof value === "bigint") return Number(value);
              return value;
            }),
          );
          process.stdout.write(JSON.stringify(rows));
        } finally {
          closeDatabase();
        }
      `,
    ],
    { encoding: "utf-8" },
  ).trim();

  return JSON.parse(output) as Array<Array<string | number | null>>;
}

async function readScalar(cwd: string, sql: string): Promise<string | number | null> {
  const rows = queryRows(cwd, sql);
  return rows[0]?.[0] ?? null;
}

async function readFeatureRow(
  cwd: string,
  id: string,
): Promise<{ title: string; status: string } | null> {
  const rows = queryRows(
    cwd,
    `SELECT title, status FROM documents WHERE id = '${id.replace(/'/g, "''")}'`,
  );
  const row = rows[0];
  if (!row) return null;
  return { title: String(row[0] ?? ""), status: String(row[1] ?? "") };
}

describe("packaged CLI auto-sync", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "grimoire-cli-autosync-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function initProject() {
    runJson(["init", "--name", "Auto Sync Test", "--cwd", tempDir]);
  }

  function createFeature(title: string): { id: string } {
    return runJson<{ id: string }>(["feature", "create", "--title", title, "--cwd", tempDir]);
  }

  test("creates the database on the first DB-backed read", async () => {
    initProject();
    const feature = createFeature("First Feature");

    expect(await exists(getDatabasePath(tempDir))).toBe(false);

    const listed = runJson<{ count: number; documents: Array<{ id: string }> }>([
      "feature",
      "list",
      "--cwd",
      tempDir,
    ]);

    expect(listed.count).toBe(1);
    expect(listed.documents[0]?.id).toBe(feature.id);
    expect(await exists(getDatabasePath(tempDir))).toBe(true);
    expect(
      Number(await readScalar(tempDir, "SELECT count(*) FROM documents WHERE type = 'feature'")),
    ).toBe(1);
  });

  test("does not resync when no files changed", async () => {
    initProject();
    createFeature("Stable Feature");
    runJson(["feature", "list", "--cwd", tempDir]);

    const firstSyncAt = String(
      await readScalar(tempDir, "SELECT value FROM _meta WHERE key = 'last_sync_at'"),
    );

    await pauseForMtimeTick();
    runJson(["feature", "list", "--cwd", tempDir]);

    const secondSyncAt = String(
      await readScalar(tempDir, "SELECT value FROM _meta WHERE key = 'last_sync_at'"),
    );

    expect(secondSyncAt).toBe(firstSyncAt);
  });

  test("syncs direct markdown edits on the next list command", async () => {
    initProject();
    const feature = createFeature("Original Title");
    runJson(["feature", "list", "--cwd", tempDir]);

    const firstSyncAt = String(
      await readScalar(tempDir, "SELECT value FROM _meta WHERE key = 'last_sync_at'"),
    );
    const featurePath = join(tempDir, ".grimoire/features", `${feature.id}.md`);

    await pauseForMtimeTick();
    const content = await readFile(featurePath, "utf-8");
    await writeFile(
      featurePath,
      content
        .replace('title: "Original Title"', 'title: "Edited Locally"')
        .replace('status: "proposed"', 'status: "complete"'),
    );

    expect(await readFeatureRow(tempDir, feature.id)).toEqual({
      title: "Original Title",
      status: "proposed",
    });
    expect(
      String(await readScalar(tempDir, "SELECT value FROM _meta WHERE key = 'last_sync_at'")),
    ).toBe(firstSyncAt);

    const listed = runJson<{ count: number; documents: Array<{ title: string }> }>([
      "feature",
      "list",
      "--status",
      "complete",
      "--cwd",
      tempDir,
    ]);

    expect(listed.count).toBe(1);
    expect(listed.documents[0]?.title).toBe("Edited Locally");
    expect(await readFeatureRow(tempDir, feature.id)).toEqual({
      title: "Edited Locally",
      status: "complete",
    });
    expect(
      String(await readScalar(tempDir, "SELECT value FROM _meta WHERE key = 'last_sync_at'")),
    ).not.toBe(firstSyncAt);
  });

  test("keeps DuckDB stale after CLI update until the next DB-backed read", async () => {
    initProject();
    const feature = createFeature("CLI Original");
    runJson(["feature", "list", "--cwd", tempDir]);

    const firstSyncAt = String(
      await readScalar(tempDir, "SELECT value FROM _meta WHERE key = 'last_sync_at'"),
    );

    await pauseForMtimeTick();
    runJson([
      "feature",
      "update",
      feature.id,
      "--title",
      "Updated Via CLI",
      "--status",
      "complete",
      "--cwd",
      tempDir,
    ]);

    expect(await readFeatureRow(tempDir, feature.id)).toEqual({
      title: "CLI Original",
      status: "proposed",
    });
    expect(
      String(await readScalar(tempDir, "SELECT value FROM _meta WHERE key = 'last_sync_at'")),
    ).toBe(firstSyncAt);

    const listed = runJson<{ count: number; documents: Array<{ title: string }> }>([
      "feature",
      "list",
      "--status",
      "complete",
      "--cwd",
      tempDir,
    ]);

    expect(listed.count).toBe(1);
    expect(listed.documents[0]?.title).toBe("Updated Via CLI");
    expect(await readFeatureRow(tempDir, feature.id)).toEqual({
      title: "Updated Via CLI",
      status: "complete",
    });
    expect(
      String(await readScalar(tempDir, "SELECT value FROM _meta WHERE key = 'last_sync_at'")),
    ).not.toBe(firstSyncAt);
  });

  test("syncs local file deletions on the next list command", async () => {
    initProject();
    const feature = createFeature("Delete Locally");
    runJson(["feature", "list", "--cwd", tempDir]);

    const firstSyncAt = String(
      await readScalar(tempDir, "SELECT value FROM _meta WHERE key = 'last_sync_at'"),
    );

    await pauseForMtimeTick();
    await unlink(join(tempDir, ".grimoire/features", `${feature.id}.md`));

    expect(await readFeatureRow(tempDir, feature.id)).toEqual({
      title: "Delete Locally",
      status: "proposed",
    });

    const listed = runJson<{ count: number }>(["feature", "list", "--cwd", tempDir]);

    expect(listed.count).toBe(0);
    expect(await readFeatureRow(tempDir, feature.id)).toBeNull();
    expect(
      String(await readScalar(tempDir, "SELECT value FROM _meta WHERE key = 'last_sync_at'")),
    ).not.toBe(firstSyncAt);
  });

  test("syncs CLI deletions on the next list command", async () => {
    initProject();
    const feature = createFeature("Delete Via CLI");
    runJson(["feature", "list", "--cwd", tempDir]);

    const firstSyncAt = String(
      await readScalar(tempDir, "SELECT value FROM _meta WHERE key = 'last_sync_at'"),
    );

    await pauseForMtimeTick();
    runJson(["feature", "delete", feature.id, "--confirm", "--cwd", tempDir]);

    expect(await readFeatureRow(tempDir, feature.id)).toEqual({
      title: "Delete Via CLI",
      status: "proposed",
    });

    const listed = runJson<{ count: number }>(["feature", "list", "--cwd", tempDir]);

    expect(listed.count).toBe(0);
    expect(await readFeatureRow(tempDir, feature.id)).toBeNull();
    expect(
      String(await readScalar(tempDir, "SELECT value FROM _meta WHERE key = 'last_sync_at'")),
    ).not.toBe(firstSyncAt);
  });
});
