// The single source of truth for API payload shapes: the API validates with
// these, the client parses with these, and both derive their types from them
// (ADR 0009). Browser-safe — nothing here may import a bun-only module.
//
// Schemas are deliberately not `.strict()`: we model the fields we use and let
// unknown ones through, so adding a field server-side doesn't break an older
// client, and Calibre's extras don't break us.

import { z } from "zod";
import { isUserColorId, PREF_KEYS, SYNC_INTERVAL_CHOICES, USER_NAME_MAX_LENGTH } from "./types.ts";

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
  /**
   * The Hardcover account this reader is linked to, or null (ADR 0012). The
   * *token* is deliberately absent and must stay that way: this payload is
   * readable by any browser that can reach Grimoire. Defaulted rather than
   * required so a response from a server predating the column still parses.
   */
  hardcoverUsername: z.string().nullable().default(null),
  /** Books on their Hardcover shelves, as of the last sync. */
  hardcoverBookCount: z.number().default(0),
  /** Those books by Hardcover status id, so settings can say what they're reading. */
  hardcoverStatusCounts: z.array(z.object({ statusId: z.number(), count: z.number() })).default([]),
  hardcoverSyncedAt: z.string().nullable().default(null),
  /** Why the last Hardcover sync failed — an expired token, most likely. */
  hardcoverSyncError: z.string().nullable().default(null),
  /**
   * Where this reader's stars live (ADR 0014): their own `ratings` rows, or
   * their Hardcover account. Defaulted to hardcover like read state below —
   * and like it, only taking effect for a linked reader; everyone else reads
   * and writes locally regardless.
   */
  ratingsSource: z.enum(["local", "hardcover"]).catch("hardcover").default("hardcover"),
  /**
   * Same choice for read state (docs/features/marking-a-book-read.md).
   * Defaulted to hardcover, but it only takes effect for a linked reader —
   * everyone else reads and writes locally regardless.
   */
  readStateSource: z.enum(["local", "hardcover"]).catch("hardcover").default("hardcover"),
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

/**
 * Body of PATCH /api/users/:id — the per-reader settings, each optional so a
 * caller sends only what changed. Just one so far (ADR 0014).
 */
export const UserSettingsSchema = z.object({
  ratingsSource: z.enum(["local", "hardcover"]).optional(),
  readStateSource: z.enum(["local", "hardcover"]).optional(),
});
export type UserSettings = z.infer<typeof UserSettingsSchema>;

// --- Hardcover -------------------------------------------------------------
// A reader's link to hardcover.app (ADR 0012). Grimoire's own payloads first,
// then the shape Hardcover itself answers with — parsed at the boundary so
// their API changing breaks here rather than three components deep.
// See docs/features/hardcover-connection.md.

/** What a probe found. `username` and `userId` are present exactly when `ok`. */
export const HardcoverTestSchema = z.object({
  ok: z.boolean(),
  /** The Hardcover account the token belongs to — proof it's the right one. */
  username: z.string().optional(),
  /** Their numeric id, which is what asking for the account's library takes. */
  userId: z.number().optional(),
  error: z.string().optional(),
});
export type HardcoverTest = z.infer<typeof HardcoverTestSchema>;

/**
 * Body of POST /api/users/:id/hardcover/test. Omit the token to re-probe the
 * one already stored, which is how an expired link is found without pasting it
 * again.
 */
export const HardcoverTestRequestSchema = z.object({
  token: z.string().optional(),
});

/** Body of PUT /api/users/:id/hardcover. */
export const HardcoverLinkSchema = z.object({
  token: z.string().trim().min(1, "Paste your Hardcover API token"),
});
export type HardcoverLink = z.infer<typeof HardcoverLinkSchema>;

// Their API's own shapes carry an `Hc` prefix, the way Calibre's carry `Cs`.
//
// Errors arrive in two dialects: GraphQL's `errors` array, and a bare
// `{ error: "Unable to verify token" }` for the ones their gateway answers
// before the query runs (401, 429). Both are optional, and neither implies the
// other is absent.
const hcErrors = {
  errors: z.array(z.object({ message: z.string() })).nullish(),
  error: z.string().nullish(),
};

/**
 * What `query { me { id username } }` comes back as. `me` is a *collection* —
 * their API is Hasura, which shapes it that way even though a token names
 * exactly one account — so a bare object is tolerated too rather than trusting
 * one reading of it.
 */
export const HcMeSchema = z.object({
  id: z.number(),
  username: z.string(),
});

export const HcMeResponseSchema = z.object({
  data: z
    .object({
      me: z.union([z.array(HcMeSchema), HcMeSchema]).nullish(),
    })
    .nullish(),
  ...hcErrors,
});

/**
 * A book as Hardcover's library query returns it. The `cached_*` fields are
 * JSON blobs with no documented shape, so they are carried as `unknown` and
 * read defensively in `hardcover-books.ts` — they are also the *only* way to
 * get contributors, tags and the cover within their depth-3 query limit.
 *
 * `title` is nullish because their catalogue has records that lack one; the
 * mirror substitutes rather than dropping the book.
 */
export const HcBookSchema = z.object({
  id: z.number(),
  title: z.string().nullish(),
  subtitle: z.string().nullish(),
  description: z.string().nullish(),
  pages: z.number().nullish(),
  release_date: z.string().nullish(),
  slug: z.string().nullish(),
  // `.optional()` is load-bearing: `z.unknown()` alone rejects a *missing* key,
  // which would fail a whole page over a field we already read defensively.
  cached_contributors: z.unknown().optional(),
  cached_image: z.unknown().optional(),
  cached_tags: z.unknown().optional(),
});

export type HcBook = z.infer<typeof HcBookSchema>;

/** One entry on a reader's shelves: the book, plus their relationship with it. */
export const HcUserBookSchema = z.object({
  id: z.number(),
  book_id: z.number(),
  /** 1 want to read, 2 reading, 3 read, 4 paused, 5 DNF, 6 ignored. */
  status_id: z.number(),
  /**
   * Theirs, 0–5 with halves — never Grimoire's stars. Postgres `numeric`, which
   * their gateway may render as a string; taking both keeps a serialisation
   * detail from failing a whole page of somebody's shelves.
   */
  rating: z.union([z.number(), z.string()]).nullish(),
  owned: z.boolean().nullish(),
  read_count: z.number().nullish(),
  date_added: z.string().nullish(),
  first_read_date: z.string().nullish(),
  last_read_date: z.string().nullish(),
  updated_at: z.string().nullish(),
  book: HcBookSchema,
});
export type HcUserBook = z.infer<typeof HcUserBookSchema>;

export const HcLibraryResponseSchema = z.object({
  data: z.object({ user_books: z.array(HcUserBookSchema) }).nullish(),
  ...hcErrors,
});

/**
 * What their user_book mutations answer with (ADR 0014). Both wrap the row in
 * a payload carrying its own `error` — a refusal their gateway reports with a
 * 200 and no GraphQL `errors`, so it has to be read, not just the envelope.
 */
const HcUserBookMutationSchema = z.object({
  error: z.string().nullish(),
  user_book: z
    .object({
      id: z.number(),
      status_id: z.number().nullish(),
      rating: z.union([z.number(), z.string()]).nullish(),
    })
    .nullish(),
});

export const HcUpdateUserBookResponseSchema = z.object({
  data: z.object({ update_user_book: HcUserBookMutationSchema.nullish() }).nullish(),
  ...hcErrors,
});

export const HcInsertUserBookResponseSchema = z.object({
  data: z.object({ insert_user_book: HcUserBookMutationSchema.nullish() }).nullish(),
  ...hcErrors,
});

/**
 * The read entries on one shelf entry — fetched after shelving so the
 * finished-when answer can be written onto (or cleared from) the read their
 * API auto-created (docs/features/rating-a-book.md).
 */
export const HcUserBookReadsResponseSchema = z.object({
  data: z
    .object({
      user_books: z.array(
        z.object({
          user_book_reads: z.array(z.object({ id: z.number() })).default([]),
        }),
      ),
    })
    .nullish(),
  ...hcErrors,
});

/** The complete reread history requested live when a details panel opens. */
export const HcReadingHistoryResponseSchema = z.object({
  data: z
    .object({
      user_books: z.array(
        z.object({
          user_book_reads: z
            .array(
              z.object({
                id: z.number(),
                finished_at: z.string().nullish(),
                finished_at_precision: z.number().nullish(),
              }),
            )
            .default([]),
        }),
      ),
    })
    .nullish(),
  ...hcErrors,
});

/** What their user_book_read mutations answer with — same envelope as the rest. */
const HcUserBookReadMutationSchema = z.object({
  error: z.string().nullish(),
  user_book_read: z.object({ id: z.number() }).nullish(),
});

export const HcUpdateUserBookReadResponseSchema = z.object({
  data: z.object({ update_user_book_read: HcUserBookReadMutationSchema.nullish() }).nullish(),
  ...hcErrors,
});

export const HcInsertUserBookReadResponseSchema = z.object({
  data: z.object({ insert_user_book_read: HcUserBookReadMutationSchema.nullish() }).nullish(),
  ...hcErrors,
});

/**
 * Their catalogue search answers ids only (Typesense behind GraphQL); a second
 * query hydrates them. Ids have been seen as both numbers and strings.
 */
export const HcSearchResponseSchema = z.object({
  data: z
    .object({
      search: z.object({ ids: z.array(z.union([z.number(), z.string()])) }).nullish(),
    })
    .nullish(),
  ...hcErrors,
});

/** The hydration for those ids — plain catalogue books, no shelf entry. */
export const HcBooksResponseSchema = z.object({
  data: z.object({ books: z.array(HcBookSchema) }).nullish(),
  ...hcErrors,
});

// The finder (docs/features/rating-a-book.md): searching Hardcover's catalogue
// for the book a Calibre-only work is, so rating it can shelve it there.

/** Body of POST /api/users/:id/hardcover/search. */
export const HardcoverSearchRequestSchema = z.object({
  query: z.string().trim().min(1, "Type something to search for"),
});

/** One catalogue book, flattened server-side from their cached_* blobs. */
export const HardcoverSearchResultSchema = z.object({
  id: z.number(),
  title: z.string(),
  authors: z.array(z.string()),
  /** Their CDN URL, rendered directly — these books have no mirrored cover yet. */
  coverUrl: z.string().nullable(),
  releaseYear: z.number().nullable(),
});
export type HardcoverSearchResult = z.infer<typeof HardcoverSearchResultSchema>;

export const HardcoverSearchResultsSchema = z.object({
  results: z.array(HardcoverSearchResultSchema),
});
export type HardcoverSearchResults = z.infer<typeof HardcoverSearchResultsSchema>;

// --- Ratings ---------------------------------------------------------------
// A reader's own stars, kept in grimoire.db and never written back to Calibre.
// See docs/features/rating-a-book.md.

/** Half stars, 0.5–5 (ADR 0014). Zero is not a rating — it's the absence of one. */
export const RatingSchema = z.number().min(0.5).max(5).multipleOf(0.5);

/**
 * GET /api/ratings — book id to rating, for the reader in X-Grimoire-User.
 * Keys are stringified ids because that's what JSON objects can hold.
 */
export const RatingsSchema = z.record(z.string(), RatingSchema);
export type Ratings = z.infer<typeof RatingsSchema>;

/**
 * GET /api/ratings/hardcover — the same map from the reader's Hardcover
 * mirror. An entry per *shelved* book: the rating (`null` where the shelf
 * entry carries none) and its reading status, which decides whether rating it
 * needs the mark-as-read ask. A key's presence doubles as "on their shelves",
 * which is what decides the add-to-shelf confirmation instead (ADR 0014).
 */
export const HardcoverRatingsSchema = z.record(
  z.string(),
  z.object({
    rating: RatingSchema.nullable(),
    /** A HARDCOVER_STATUS id — their vocabulary, passed through. */
    statusId: z.number(),
  }),
);
export type HardcoverRatings = z.infer<typeof HardcoverRatingsSchema>;

/** Where a rating write lands (ADR 0014). */
export const RatingSourceSchema = z.enum(["local", "hardcover"]);
export type RatingSource = z.infer<typeof RatingSourceSchema>;

/**
 * A finished-when at whatever precision the reader knows — "2023", "2023-06"
 * or "2023-06-15" (docs/features/marking-a-book-read.md).
 */
export const FinishedAtSchema = z
  .string()
  .regex(/^\d{4}(-\d{2})?(-\d{2})?$/, "A date, like 2023, 2023-06 or 2023-06-15")
  .refine((value) => {
    const [, month, day] = value.split("-").map(Number);
    return (
      (month === undefined || (month >= 1 && month <= 12)) &&
      (day === undefined || (day >= 1 && day <= 31))
    );
  }, "Not a real date");

/** Known finish dates for one book, newest read first. */
export const ReadDatesSchema = z.object({ dates: z.array(FinishedAtSchema) });
export type ReadDates = z.infer<typeof ReadDatesSchema>;

/**
 * What Hardcover has written about one book, read live for an open details
 * panel (docs/features/book-details-panel.md) and never mirrored. Empty
 * throughout for a book Hardcover has nothing for, or a reader with no linked
 * account — the panel falls back to Calibre either way, so this is not an error.
 */
export const HardcoverContentSchema = z.object({
  /** Their description — plain text as often as not, occasionally HTML. */
  about: z.string().nullable().default(null),
  /** Their Genre and Tag categories, in that order. */
  tags: z.array(z.string()).default([]),
  /** Their Mood category, which Calibre has no equivalent for. */
  moods: z.array(z.string()).default([]),
  /**
   * The book's page on hardcover.app, built from the mirrored slug. Unlike the
   * three above it needs no token and survives a failed request — it is the
   * one field here that comes out of the mirror rather than their API.
   */
  url: z.url().nullable().default(null),
});
export type HardcoverContent = z.infer<typeof HardcoverContentSchema>;

/**
 * A stored preference that reads as a boolean. Absent means **on**: these were
 * added to libraries that already existed, and asking everyone to opt back in
 * to a default is a migration nobody wanted. Anything unparseable reads as on
 * too, for the same reason.
 */
const prefOn = z.stringbool().catch(true).default(true);

/**
 * Which of Hardcover's writing about a book wins over Calibre's — instance-wide
 * (docs/features/settings.md), unlike the per-reader source toggles above:
 * these say what a *book* looks like, not whose account an answer comes from.
 */
export const HardcoverContentPrefsSchema = z.object({
  about: prefOn,
  tags: prefOn,
  moods: prefOn,
});
export type HardcoverContentPrefs = z.infer<typeof HardcoverContentPrefsSchema>;

/** Read those three out of the flat preferences record. Never throws. */
export function hardcoverContentPrefs(preferences: Preferences | undefined): HardcoverContentPrefs {
  return HardcoverContentPrefsSchema.parse({
    about: preferences?.[PREF_KEYS.hardcoverAbout],
    tags: preferences?.[PREF_KEYS.hardcoverTags],
    moods: preferences?.[PREF_KEYS.hardcoverMoods],
  });
}

/**
 * Body of PUT /api/ratings/:bookId. Zero clears the rating. With
 * `source: "hardcover"` the write goes to the reader's hardcover.app account;
 * `addToShelf` relays their confirmation that rating an unshelved book may add
 * it to their shelves as Read — without it, that case answers 409.
 */
export const RatingUpdateSchema = z.object({
  rating: z.number().min(0).max(5).multipleOf(0.5),
  source: RatingSourceSchema.default("local"),
  addToShelf: z.boolean().default(false),
  /**
   * For a work with no Hardcover edition: the catalogue book the reader picked
   * in the finder. The API shelves it as Read, rates it, and links it into the
   * work (docs/features/rating-a-book.md).
   */
  hardcoverBookId: z.number().int().positive().optional(),
  /**
   * The reader's confirmation that rating a shelved-but-unfinished book —
   * Want to Read, Currently Reading, Paused — may flip its status to Read
   * alongside the rating (docs/features/rating-a-book.md).
   */
  markRead: z.boolean().default(false),
  /**
   * When the reader finished the book being shelved, at whatever precision
   * they know it — "2023", "2023-06", or "2023-06-15". Absent means "I don't
   * know": the Hardcover read entry gets its dates *cleared*, rather than
   * letting their API default them to today.
   */
  finishedAt: FinishedAtSchema.optional(),
});
export type RatingUpdate = z.infer<typeof RatingUpdateSchema>;

/** What that PUT answers with: the stored rating, or null once cleared. */
export const RatingResultSchema = z.object({
  bookId: z.number(),
  rating: RatingSchema.nullable(),
});
export type RatingResult = z.infer<typeof RatingResultSchema>;

// --- Read state --------------------------------------------------------------
// The cover's corner check (docs/features/marking-a-book-read.md). Shaped like
// ratings: a per-reader map keyed by work id, absence meaning unread.

/**
 * GET /api/read-states — the reader's *local* read states. In Hardcover mode
 * the client reads status 3 off the Hardcover ratings map instead.
 */
export const ReadStatesSchema = z.record(
  z.string(),
  z.object({ finishedAt: FinishedAtSchema.nullable() }),
);
export type ReadStates = z.infer<typeof ReadStatesSchema>;

/**
 * Body of PUT /api/read-states/:bookId. Marking read takes the finished-when
 * and an optional rating (written to the same source, so it can't scatter);
 * unmarking takes `removeRating` — the modal's keep-or-remove answer. The
 * Hardcover fields mean what they do on the ratings route (ADR 0014).
 */
export const ReadStateUpdateSchema = z.object({
  read: z.boolean(),
  finishedAt: FinishedAtSchema.optional(),
  rating: RatingSchema.optional(),
  removeRating: z.boolean().default(false),
  source: RatingSourceSchema.default("local"),
  addToShelf: z.boolean().default(false),
  hardcoverBookId: z.number().int().positive().optional(),
});
export type ReadStateUpdate = z.infer<typeof ReadStateUpdateSchema>;

/** What that PUT answers with — the stored state after the write. */
export const ReadStateResultSchema = z.object({
  bookId: z.number(),
  read: z.boolean(),
  finishedAt: FinishedAtSchema.nullable(),
});
export type ReadStateResult = z.infer<typeof ReadStateResultSchema>;

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
  /**
   * Every source this book came from — `["calibre"]`, `["hardcover"]`, and
   * after matching lands, both on one book. Plural from the start because the
   * UI marks each one, and a book that is genuinely in two libraries is the
   * point of the next step (docs/features/hardcover-sync.md).
   */
  sources: z.array(z.string()).default([]),
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
  /**
   * Every cached cover this work has — one per member that brought one, so a
   * book held in Calibre *and* on Hardcover offers both
   * (docs/features/book-details-panel.md). Ordered as the shelf would pick
   * them, and empty for a book with no cached cover at all.
   *
   * This is the one place a member row id crosses to the browser. Choosing
   * between covers means naming them, and an index into this list would shift
   * under a sync while a panel was open.
   */
  covers: z.array(z.object({ bookId: z.number(), source: z.string() })).default([]),
  /**
   * The member currently serving as this work's cover — the chosen one, or the
   * rule's pick when nobody has chosen. Null when there is no cached cover.
   * Also what makes a cover URL change when the choice does, so a swap is not
   * hidden behind the browser cache.
   */
  coverBookId: z.number().nullable().default(null),
  /**
   * How many book rows this work is made of — 1 for nearly every book. Not the
   * same as `sources.length`: two Calibre rows a reader joined by hand are two
   * entries from one source (docs/features/resolving-duplicates.md).
   */
  entries: z.number().default(1),
  /**
   * A cover Grimoire holds no file for, served from the source's own CDN —
   * Hardcover books, today. Null for anything with a cached cover, and the
   * reason a Hardcover book's cover needs the network (docs/features/hardcover-sync.md).
   */
  coverUrl: z.string().nullable().default(null),
});
export type Book = z.infer<typeof BookSchema>;

export const BooksSchema = z.array(BookSchema);

/** Body of PUT /api/books/:id/cover — which member's cover this work should show. */
export const CoverChoiceSchema = z.object({
  bookId: z.number().int().positive(),
});
export type CoverChoice = z.infer<typeof CoverChoiceSchema>;

// --- Duplicates ------------------------------------------------------------
// The entries a work is made of, and the ones that look like they belong in it
// (docs/features/resolving-duplicates.md).

/** One of the rows a work is made of — what the panel lists under "Same book". */
export const WorkMemberSchema = z.object({
  /** A member row id. The other place one crosses to the browser is `covers`. */
  bookId: z.number(),
  source: z.string(),
  /** This row's own title, not the work's merged one — the point is the difference. */
  title: z.string(),
  authors: z.array(z.string()).default([]),
});
export type WorkMember = z.infer<typeof WorkMemberSchema>;

/**
 * Why a candidate is being suggested, worst-first in confidence: the matcher
 * would have grouped an `exact` pair had they come from different sources,
 * where the other two are relaxations it refuses on purpose.
 */
export const DuplicateReasonSchema = z.enum(["exact", "subtitle", "title"]);
export type DuplicateReason = z.infer<typeof DuplicateReasonSchema>;

/**
 * Another work that looks like the same book. It carries no metadata: the
 * client already holds every work from `GET /api/books`, so naming one is
 * enough and keeps the two from drifting apart.
 */
export const DuplicateCandidateSchema = z.object({
  /** The other work — what the client looks up, and what a merge names. */
  workId: z.number(),
  /** The member of *this* work the pair was found from. */
  bookId: z.number(),
  /** The member of the other work it matched. Both are needed to rule the pair out. */
  otherBookId: z.number(),
  reason: DuplicateReasonSchema,
});
export type DuplicateCandidate = z.infer<typeof DuplicateCandidateSchema>;

/** What GET /api/books/:id/duplicates answers with. */
export const DuplicatesSchema = z.object({
  members: z.array(WorkMemberSchema).default([]),
  candidates: z.array(DuplicateCandidateSchema).default([]),
});
export type Duplicates = z.infer<typeof DuplicatesSchema>;

/**
 * One unanswered pair in the library-wide review queue
 * (docs/features/resolving-duplicates.md) — a candidate with the work it was
 * found from, which is everything the panel's two answers need.
 */
export const PendingDuplicateSchema = z.object({
  workId: z.number(),
  otherWorkId: z.number(),
  bookId: z.number(),
  otherBookId: z.number(),
  reason: DuplicateReasonSchema,
});
export type PendingDuplicate = z.infer<typeof PendingDuplicateSchema>;

/** What GET /api/duplicates answers with. `total` counts past the cap. */
export const PendingDuplicatesSchema = z.object({
  pairs: z.array(PendingDuplicateSchema).default([]),
  total: z.number(),
});
export type PendingDuplicates = z.infer<typeof PendingDuplicatesSchema>;

/** Body of POST /api/books/:id/duplicates — the work that is the same book. */
export const DuplicateLinkSchema = z.object({
  workId: z.number().int().positive(),
});
export type DuplicateLink = z.infer<typeof DuplicateLinkSchema>;

/**
 * Body of POST /api/books/:id/duplicates/dismiss — the pair of rows that are
 * not the same book. Rows rather than works, because a row is the stable thing.
 */
export const DuplicateDismissSchema = z.object({
  bookId: z.number().int().positive(),
  otherBookId: z.number().int().positive(),
});
export type DuplicateDismiss = z.infer<typeof DuplicateDismissSchema>;

/** Body of POST /api/books/:id/separate — the member to move back out on its own. */
export const WorkSeparateSchema = z.object({
  bookId: z.number().int().positive(),
});
export type WorkSeparate = z.infer<typeof WorkSeparateSchema>;

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

/**
 * What one matching pass did (POST /api/match). Conflicts are groups it
 * deliberately left alone — see docs/features/book-matching.md.
 */
export const MatchOutcomeSchema = z.object({
  grouped: z.number(),
  conflicts: z.number(),
});
export type MatchOutcome = z.infer<typeof MatchOutcomeSchema>;

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
