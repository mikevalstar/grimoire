// Plain constants shared with the browser. Nothing here may import a bun-only
// module — `apps/web` pulls this file in directly. Payload *shapes* live in
// `schemas.ts` (ADR 0009); this file is for values that aren't wire formats.

/**
 * Bump when new setup is required from the user. The UI runs first-time setup
 * whenever the stored version is below this.
 *
 * 2 — the setup wizard gained a "who's reading" step
 *     (docs/features/first-run-setup-wizard.md).
 */
export const PREFERENCES_VERSION = 2;

export const PREF_KEYS = {
  version: "preferences.version",
  calibreServerUrl: "calibre.serverUrl",
} as const;

/** Longest reader name we accept; the UI caps the input at the same number. */
export const USER_NAME_MAX_LENGTH = 40;

/**
 * Names the reader a request is acting as (ADR 0008). Not a credential — the
 * API trusts it — but user-scoped routes refuse a request without it rather
 * than picking someone.
 */
export const USER_HEADER = "X-Grimoire-User";

export interface UserColor {
  /** What's stored in `users.color` — never the hex, so the palette can be restyled. */
  id: string;
  /** Shown as the swatch's accessible name. */
  name: string;
  hex: string;
}

/**
 * The 24 colours a reader can be. They identify a *person* and appear only on
 * that person's avatar or chip — never on library data, where the shell's
 * indigo/amber duotone rule holds (docs/features/application-shell.md).
 *
 * Ordered around the wheel so the auto-assignment below (first colour nobody
 * has taken) hands out visibly different colours to the first few readers.
 */
export const USER_COLORS = [
  { id: "indigo", name: "Indigo", hex: "#6366f1" },
  { id: "crimson", name: "Crimson", hex: "#e11d48" },
  { id: "emerald", name: "Emerald", hex: "#10b981" },
  { id: "amber", name: "Amber", hex: "#f59e0b" },
  { id: "sky", name: "Sky", hex: "#0ea5e9" },
  { id: "orchid", name: "Orchid", hex: "#d946ef" },
  { id: "moss", name: "Moss", hex: "#65a30d" },
  { id: "ember", name: "Ember", hex: "#f97316" },
  { id: "teal", name: "Teal", hex: "#14b8a6" },
  { id: "plum", name: "Plum", hex: "#9333ea" },
  { id: "rose", name: "Rose", hex: "#fb7185" },
  { id: "denim", name: "Denim", hex: "#1d4ed8" },
  { id: "fern", name: "Fern", hex: "#22c55e" },
  { id: "magenta", name: "Magenta", hex: "#ec4899" },
  { id: "cyan", name: "Cyan", hex: "#06b6d4" },
  { id: "gold", name: "Gold", hex: "#ca8a04" },
  { id: "violet", name: "Violet", hex: "#8b5cf6" },
  { id: "pine", name: "Pine", hex: "#047857" },
  { id: "coral", name: "Coral", hex: "#ef4444" },
  { id: "azure", name: "Azure", hex: "#3b82f6" },
  { id: "clay", name: "Clay", hex: "#b45309" },
  { id: "lilac", name: "Lilac", hex: "#a78bfa" },
  { id: "sea", name: "Sea", hex: "#0d9488" },
  { id: "slate", name: "Slate", hex: "#64748b" },
] as const satisfies readonly UserColor[];

export type UserColorId = (typeof USER_COLORS)[number]["id"];

export const DEFAULT_USER_COLOR: UserColorId = "indigo";

export function isUserColorId(id: string): id is UserColorId {
  return USER_COLORS.some((color) => color.id === id);
}

/** The colour for a stored id, falling back rather than rendering nothing. */
export function userColor(id: string): UserColor {
  return USER_COLORS.find((color) => color.id === id) ?? USER_COLORS[0];
}

/**
 * The first colour nobody has taken, so a household that just types names gets
 * distinguishable people. Past 24 readers colours repeat, which is fine.
 */
export function nextUserColor(taken: readonly string[]): UserColorId {
  return (USER_COLORS.find((color) => !taken.includes(color.id)) ?? USER_COLORS[0]).id;
}
