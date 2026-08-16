// Plain constants shared with the browser. Nothing here may import a bun-only
// module — `apps/web` pulls this file in directly. Payload *shapes* live in
// `schemas.ts` (ADR 0009); this file is for values that aren't wire formats.

/**
 * Bump when new setup is required from the user. The UI runs first-time setup
 * whenever the stored version is below this.
 *
 * 2 — the setup wizard gained a "who's reading" step
 *     (docs/features/first-run-setup-wizard.md).
 * 3 — the wizard gained an optional per-reader Hardcover step
 *     (docs/features/hardcover-connection.md).
 */
export const PREFERENCES_VERSION = 3;

export const PREF_KEYS = {
  version: "preferences.version",
  calibreServerUrl: "calibre.serverUrl",

  // Calibre sync (ADR 0011). Live progress is deliberately absent — it changes
  // several times a second and is worthless after a restart, so it stays as
  // in-process state on the scheduler.
  syncLastCompletedAt: "sync.lastCompletedAt",
  syncLastAttemptedAt: "sync.lastAttemptedAt",
  syncLastStatus: "sync.lastStatus",
  syncLastError: "sync.lastError",
  /** The actionable half of a failure — e.g. "start it with `calibre-server`". */
  syncLastErrorHint: "sync.lastErrorHint",
  /** Newest Calibre `last_modified` ingested; where an incremental sweep stops. */
  syncWatermark: "sync.watermark",
  syncIntervalMinutes: "sync.intervalMinutes",

  // Which of Hardcover's writing about a book the details panel prefers over
  // Calibre's (docs/features/book-details-panel.md). Instance-wide, because
  // they say what a book looks like rather than whose account an answer comes
  // from — and all three read as on when absent, so no migration is owed.
  hardcoverAbout: "hardcover.about",
  hardcoverTags: "hardcover.tags",
  hardcoverMoods: "hardcover.moods",
  /**
   * The odd one of the four: About, Tags and Moods are fetched live for an open
   * panel, while a series is *stored* — sorting the shelf by one cannot wait on
   * a request per book. So this decides which stored attachment wins, not
   * whether to go and ask (ADR 0019).
   */
  hardcoverSeries: "hardcover.series",
} as const;

/**
 * Where a work's attachment to a series came from (ADR 0019). Reconcile
 * recomputes `calibre` and `hardcover` on every sweep and never touches
 * `manual` — a person decided that one, the way they decide a work's cover.
 */
export const SERIES_SOURCE = {
  calibre: "calibre",
  hardcover: "hardcover",
  manual: "manual",
} as const;

export type SeriesSource = (typeof SERIES_SOURCE)[keyof typeof SERIES_SOURCE];

/** What a book record was ingested from. `books.source` holds one of these. */
export const BOOK_SOURCE = {
  calibre: "calibre",
  /** A book on a reader's hardcover.app shelves (docs/features/hardcover-sync.md). */
  hardcover: "hardcover",
  /** Entered in Grimoire itself. Nothing creates these yet. */
  grimoire: "grimoire",
} as const;

export type BookSource = (typeof BOOK_SOURCE)[keyof typeof BOOK_SOURCE];

/**
 * Hardcover's reading statuses, by the integer their API sends. Stored as that
 * integer rather than a name of ours: it is their vocabulary, and mapping it to
 * a Grimoire read state is a decision that belongs to a read-status feature.
 */
export const HARDCOVER_STATUS = {
  1: "Want to read",
  2: "Reading",
  3: "Read",
  4: "Paused",
  5: "Did not finish",
  6: "Ignored",
} as const;

export type HardcoverStatusId = keyof typeof HARDCOVER_STATUS;

/** The label for a status id, falling back rather than rendering a bare number. */
export function hardcoverStatusLabel(id: number): string {
  return HARDCOVER_STATUS[id as HardcoverStatusId] ?? `Status ${id}`;
}

/**
 * Cover sizes cached on disk, keyed by *Grimoire* book id so a book keeps its
 * cover after leaving Calibre. All 2:3, all fetched from Calibre's own scaler.
 * Drawn sizes come from the book views, at 2× (docs/features/book-list.md).
 */
export const COVER_SIZES = {
  /** The list view's row thumbnail, drawn at 28px. */
  thumb: { width: 80, height: 120 },
  /** The cover grid's card, drawn at ~180px. */
  card: { width: 360, height: 540 },
  /** The detail panel, which does not exist yet. */
  full: { width: 720, height: 1080 },
} as const;

export type CoverSize = keyof typeof COVER_SIZES;

export const COVER_SIZE_NAMES = Object.keys(COVER_SIZES) as CoverSize[];

export function isCoverSize(value: string): value is CoverSize {
  return value in COVER_SIZES;
}

/** Minutes between automatic syncs. 0 means never; the UI offers exactly these. */
export const SYNC_INTERVAL_CHOICES = [0, 1, 5, 15, 30, 60] as const;

export const DEFAULT_SYNC_INTERVAL_MINUTES = 5;

/**
 * The stored interval, falling back rather than refusing to sync. Anything
 * unparseable or off the list is treated as "never configured".
 */
export function syncIntervalMinutes(stored: string | null | undefined): number {
  const minutes = Number(stored);
  if (!Number.isFinite(minutes)) return DEFAULT_SYNC_INTERVAL_MINUTES;
  return (SYNC_INTERVAL_CHOICES as readonly number[]).includes(minutes)
    ? minutes
    : DEFAULT_SYNC_INTERVAL_MINUTES;
}

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
