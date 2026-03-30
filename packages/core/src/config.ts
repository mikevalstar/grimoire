/**
 * Load and parse .grimoire/config.yaml.
 * Returns sensible defaults when the file is missing or malformed.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

const GRIMOIRE_DIR = ".grimoire";
const CONFIG_FILE = "config.yaml";

export interface GrimoireConfig {
  sync: {
    auto_sync: boolean;
    watch: boolean;
  };
}

const DEFAULT_CONFIG: GrimoireConfig = {
  sync: {
    auto_sync: true,
    watch: false,
  },
};

export async function loadConfig(cwd: string = process.cwd()): Promise<GrimoireConfig> {
  const configPath = join(cwd, GRIMOIRE_DIR, CONFIG_FILE);

  let raw: Record<string, unknown>;
  try {
    const content = await readFile(configPath, "utf-8");
    raw = parseYaml(content) as Record<string, unknown>;
  } catch {
    return DEFAULT_CONFIG;
  }

  if (!raw || typeof raw !== "object") return DEFAULT_CONFIG;

  const syncSection = raw.sync as Record<string, unknown> | undefined;

  return {
    sync: {
      auto_sync: typeof syncSection?.auto_sync === "boolean" ? syncSection.auto_sync : true,
      watch: typeof syncSection?.watch === "boolean" ? syncSection.watch : false,
    },
  };
}
