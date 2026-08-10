// The single source of truth for API payload shapes: the API validates with
// these, the client parses with these, and both derive their types from them
// (ADR 0009). Browser-safe — nothing here may import a bun-only module.
//
// Schemas are deliberately not `.strict()`: we model the fields we use and let
// unknown ones through, so adding a field server-side doesn't break an older
// client, and Calibre's extras don't break us.

import { z } from "zod";

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

export const ApiErrorSchema = z.object({
  error: z.string(),
  hint: z.string().optional(),
});

// --- Calibre content server ------------------------------------------------
// Responses from /api/cs/*. These belong to Calibre, not us: parsing them at
// the boundary is where a Calibre upgrade should break, loudly (ADR 0005).

/** GET /api/cs/ajax/search */
export const CsSearchSchema = z.object({
  book_ids: z.array(z.number()),
  total_num: z.number(),
  num: z.number(),
  offset: z.number(),
});
export type CsSearch = z.infer<typeof CsSearchSchema>;

/** One entry of GET /api/cs/ajax/books?ids=… */
export const CsBookSchema = z.object({
  title: z.string(),
  authors: z.array(z.string()).nullish(),
  series: z.string().nullish(),
  series_index: z.number().nullish(),
  /** Calibre's ajax layer reports stars out of 5 here, unlike metadata.db. */
  rating: z.number().nullish(),
  tags: z.array(z.string()).nullish(),
  formats: z.array(z.string()).nullish(),
  pubdate: z.string().nullish(),
  timestamp: z.string().nullish(),
  cover: z.string().nullish(),
  thumbnail: z.string().nullish(),
});
export type CsBook = z.infer<typeof CsBookSchema>;

/** Calibre answers with an id-keyed object, and nulls ids it doesn't know. */
export const CsBooksSchema = z.record(z.string(), CsBookSchema.nullable());
export type CsBooks = z.infer<typeof CsBooksSchema>;
