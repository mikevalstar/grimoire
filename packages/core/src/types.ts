// Plain constants shared with the browser. Nothing here may import a bun-only
// module — `apps/web` pulls this file in directly. Payload *shapes* live in
// `schemas.ts` (ADR 0009); this file is for values that aren't wire formats.

/**
 * Bump when new setup is required from the user. The UI runs first-time setup
 * whenever the stored version is below this.
 */
export const PREFERENCES_VERSION = 1;

export const PREF_KEYS = {
  version: "preferences.version",
  calibreServerUrl: "calibre.serverUrl",
} as const;
