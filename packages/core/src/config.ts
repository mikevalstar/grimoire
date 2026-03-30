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
  embedding: {
    provider: "local" | "ollama" | "openai";
    model: string;
  };
  search: {
    default_limit: number;
    keyword_weight: number;
    semantic_weight: number;
  };
  sync: {
    auto_sync: boolean;
    watch: boolean;
  };
  ui: {
    port: number;
    auto_open: boolean;
  };
}

const DEFAULT_CONFIG: GrimoireConfig = {
  embedding: {
    provider: "local",
    model: "nomic-embed-text-v1.5",
  },
  search: {
    default_limit: 10,
    keyword_weight: 0.5,
    semantic_weight: 0.5,
  },
  sync: {
    auto_sync: true,
    watch: false,
  },
  ui: {
    port: 4444,
    auto_open: true,
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

  const embeddingSection = raw.embedding as Record<string, unknown> | undefined;
  const searchSection = raw.search as Record<string, unknown> | undefined;
  const syncSection = raw.sync as Record<string, unknown> | undefined;
  const uiSection = raw.ui as Record<string, unknown> | undefined;

  return {
    embedding: {
      provider:
        embeddingSection?.provider === "ollama" || embeddingSection?.provider === "openai"
          ? embeddingSection.provider
          : "local",
      model:
        typeof embeddingSection?.model === "string"
          ? embeddingSection.model
          : "nomic-embed-text-v1.5",
    },
    search: {
      default_limit:
        typeof searchSection?.default_limit === "number" ? searchSection.default_limit : 10,
      keyword_weight:
        typeof searchSection?.keyword_weight === "number" ? searchSection.keyword_weight : 0.5,
      semantic_weight:
        typeof searchSection?.semantic_weight === "number" ? searchSection.semantic_weight : 0.5,
    },
    sync: {
      auto_sync: typeof syncSection?.auto_sync === "boolean" ? syncSection.auto_sync : true,
      watch: typeof syncSection?.watch === "boolean" ? syncSection.watch : false,
    },
    ui: {
      port: typeof uiSection?.port === "number" ? uiSection.port : 4444,
      auto_open: typeof uiSection?.auto_open === "boolean" ? uiSection.auto_open : true,
    },
  };
}
