// The single source of truth for API payload shapes: the API validates with
// these, the client parses with these, and both derive their types from them
// (ADR 0009). Browser-safe — nothing here may import a bun-only module.
//
// Schemas are deliberately not `.strict()`: we model the fields we use and let
// unknown ones through, so adding a field server-side doesn't break an older
// client, and Calibre's extras don't break us.

import { z } from "zod";
import { isUserColorId, SYNC_INTERVAL_CHOICES, USER_NAME_MAX_LENGTH } from "./types.ts";

/** Every preference is stored as text; callers coerce as needed. */
export const PreferencesSchema = z.record(z.string(), z.string());
export type Preferences = z.infer<typeof PreferencesSchema>;

/** Body of PUT /api/preferences — a merge-update, so any subset of keys. */
export const PreferencesUpdateSchema = PreferencesSchema;

export const CalibreServerTestSchema = z.object({
  ok: z.boolean(),
  /** Books reported by the content server, when the probe succeeded. */
  bookCount: z.number().optional(),
  error: z.string().optional(),
});
export type CalibreServerTest = z.infer<typeof CalibreServerTestSchema>;

/** Body of POST /api/calibre/test. Omit the url to probe the stored one. */
export const CalibreTestRequestSchema = z.object({
  url: z.string().optional(),
});

// --- Readers ---------------------------------------------------------------
// People sharing one library, created by the setup wizard. No credentials —
// see ADR 0008.

export const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  /** A USER_COLORS id, not a hex. Left as a plain string so an unknown id from
   *  a newer server doesn't break an older client — the UI falls back. */
  color: z.string(),
  createdAt: z.string(),
});
export type User = z.infer<typeof UserSchema>;

export const UsersSchema = z.array(UserSchema);

/** Body of POST /api/users. Omit the colour to get the first unused one. */
export const UserCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "A name is required")
    .max(USER_NAME_MAX_LENGTH, `Keep it under ${USER_NAME_MAX_LENGTH} characters`),
  color: z.string().refine(isUserColorId, "Not one of Grimoire's reader colours").optional(),
});
export type UserCreate = z.infer<typeof UserCreateSchema>;

// --- Ratings ---------------------------------------------------------------
// A reader's own stars, kept in grimoire.db and never written back to Calibre.
// See docs/features/rating-a-book.md.

/** Whole stars, 1–5. Zero is not a rating — it's the absence of one. */
export const RatingSchema = z.number().int().min(1).max(5);

/**
 * GET /api/ratings — book id to rating, for the reader in X-Grimoire-User.
 * Keys are stringified ids because that's what JSON objects can hold.
 */
export const RatingsSchema = z.record(z.string(), RatingSchema);
export type Ratings = z.infer<typeof RatingsSchema>;

/** Body of PUT /api/ratings/:bookId. Zero clears the rating. */
export const RatingUpdateSchema = z.object({
  rating: z.number().int().min(0).max(5),
});
export type RatingUpdate = z.infer<typeof RatingUpdateSchema>;

/** What that PUT answers with: the stored rating, or null once cleared. */
export const RatingResultSchema = z.object({
  bookId: z.number(),
  rating: RatingSchema.nullable(),
});
export type RatingResult = z.infer<typeof RatingResultSchema>;

export const ApiErrorSchema = z.object({
  error: z.string(),
  hint: z.string().optional(),
});

// --- Books -----------------------------------------------------------------
// Grimoire's own book record, served from grimoire.db rather than fetched from
// Calibre per page load (ADR 0011). This is the shape every library screen
// renders; ratings are deliberately not on it, being per-reader.

export const BookSchema = z.object({
  /** Grimoire's id — what every Grimoire-owned row points at, and what names a cover file. */
  id: z.number(),
  /** Where the record was ingested from: "calibre" today. */
  source: z.string(),
  /**
   * Calibre's book id, or null once the book is no longer in the connected
   * library. This is the *only* "is it still there?" test — and the only thing
   * that can build a download URL, which is why a null means no download button.
   */
  calibreId: z.number().nullable(),
  title: z.string(),
  authors: z.array(z.string()),
  series: z.string().nullable(),
  seriesIndex: z.number().nullable(),
  tags: z.array(z.string()),
  /** Uppercased, e.g. ["EPUB", "PDF"]. */
  formats: z.array(z.string()),
  publisher: z.string().nullable(),
  languages: z.array(z.string()),
  /** e.g. { isbn: "…", google: "…" }. */
  identifiers: z.record(z.string(), z.string()),
  description: z.string().nullable(),
  pages: z.number().nullable(),
  /** Publication date — ISO 8601, or null. */
  published: z.string().nullable(),
  /** When Calibre took the book in — ISO 8601. */
  added: z.string(),
  /** Whether a cached cover exists: "cached" is the only one worth requesting. */
  coverState: z.enum(["none", "cached", "missing"]),
});
export type Book = z.infer<typeof BookSchema>;

export const BooksSchema = z.array(BookSchema);

// --- Sync ------------------------------------------------------------------
// docs/features/calibre-sync.md

/** Which phase a running sync is in; `idle` when nothing is running. */
export const SyncPhaseSchema = z.enum(["idle", "mirror", "reconcile", "covers"]);
export type SyncPhase = z.infer<typeof SyncPhaseSchema>;

export const SyncProgressSchema = z.object({
  phase: SyncPhaseSchema,
  done: z.number(),
  /** Null while a phase doesn't yet know its own size. */
  total: z.number().nullable(),
});
export type SyncProgress = z.infer<typeof SyncProgressSchema>;

export const SyncStatusSchema = z.object({
  running: z.boolean(),
  /** Present only while running. */
  progress: SyncProgressSchema.nullable(),
  lastCompletedAt: z.string().nullable(),
  lastAttemptedAt: z.string().nullable(),
  lastStatus: z.enum(["ok", "error"]).nullable(),
  /** The failure message, cleared by the next success. Drives the red indicator. */
  lastError: z.string().nullable(),
  /** Hint for a failure the proxy can explain, e.g. a content server that isn't running. */
  lastErrorHint: z.string().nullable(),
  /** Rows in `books` — everything Grimoire knows about, including books that have left Calibre. */
  bookCount: z.number(),
  /** Of those, how many are still in the connected library. */
  inLibraryCount: z.number(),
  intervalMinutes: z.number(),
  /** False until a Calibre server URL is configured; the scheduler stays idle. */
  configured: z.boolean(),
});
export type SyncStatus = z.infer<typeof SyncStatusSchema>;

/** Body of PUT /api/sync/settings. */
export const SyncSettingsUpdateSchema = z.object({
  intervalMinutes: z
    .number()
    .refine(
      (m) => (SYNC_INTERVAL_CHOICES as readonly number[]).includes(m),
      `Pick one of ${SYNC_INTERVAL_CHOICES.join(", ")} minutes`,
    ),
});
export type SyncSettingsUpdate = z.infer<typeof SyncSettingsUpdateSchema>;

// --- Calibre content server ------------------------------------------------
// Responses from /api/cs/*. These belong to Calibre, not us: parsing them at
// the boundary is where a Calibre upgrade should break, loudly (ADR 0005).

/** GET /api/cs/ajax/search */
export const CsSearchSchema = z.object({
  book_ids: z.array(z.number()),
  total_num: z.number(),
  num: z.number(),
  offset: z.number(),
  /**
   * Which library answered — a slug of its *folder name*, so two unrelated
   * libraries both in a "Calibre Library" folder report the same string. Stored
   * as a diagnostic label; never as identity (ADR 0011).
   */
  library_id: z.string().nullish(),
});
export type CsSearch = z.infer<typeof CsSearchSchema>;

/** One entry of GET /api/cs/ajax/books?ids=… */
export const CsBookSchema = z.object({
  /**
   * Calibre's per-book uuid, and the identity the sync matches on — book *ids*
   * are sequential and scoped to one library, so id 42 names a different book
   * in every library (ADR 0011). Required: a book without one cannot be
   * mirrored safely, and every book in a stock library has one.
   */
  uuid: z.string(),
  title: z.string(),
  title_sort: z.string().nullish(),
  authors: z.array(z.string()).nullish(),
  author_sort: z.string().nullish(),
  series: z.string().nullish(),
  series_index: z.number().nullish(),
  // Calibre reports a `rating` here (out of 5, unlike metadata.db). It is not
  // modelled: ratings in Grimoire are per-reader and ours alone, so reading
  // Calibre's would only invite it back in as a fallback. Schemas are
  // non-strict, so it passes through harmlessly.
  tags: z.array(z.string()).nullish(),
  formats: z.array(z.string()).nullish(),
  publisher: z.string().nullish(),
  languages: z.array(z.string()).nullish(),
  identifiers: z.record(z.string(), z.string()).nullish(),
  comments: z.string().nullish(),
  pages: z.number().nullish(),
  /** Calibre sends the literal string "None" for an unset date, not null. */
  pubdate: z.string().nullish(),
  timestamp: z.string().nullish(),
  /** Calibre's own mtime. Drives change detection and cover invalidation. */
  last_modified: z.string().nullish(),
  cover: z.string().nullish(),
  thumbnail: z.string().nullish(),
});
export type CsBook = z.infer<typeof CsBookSchema>;

/** Calibre answers with an id-keyed object, and nulls ids it doesn't know. */
export const CsBooksSchema = z.record(z.string(), CsBookSchema.nullable());
export type CsBooks = z.infer<typeof CsBooksSchema>;
