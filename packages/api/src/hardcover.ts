import {
  type HardcoverTest,
  type HcBook,
  HcBooksResponseSchema,
  HcInsertUserBookResponseSchema,
  HcLibraryResponseSchema,
  HcMeResponseSchema,
  HcReadingHistoryResponseSchema,
  HcSearchResponseSchema,
  HcSeriesResponseSchema,
  type HcSeriesRosterEntry,
  HcSeriesRosterResponseSchema,
  HcUpdateUserBookReadResponseSchema,
  HcUpdateUserBookResponseSchema,
  type HcUserBook,
  HcUserBookReadsResponseSchema,
} from "@grimoire/core";
import type { z } from "zod";

/**
 * Talking to hardcover.app (ADR 0012). Server-side only, and not by our
 * preference: their API refuses requests that come from a browser, because a
 * token is full access to the account behind it.
 *
 * See docs/features/hardcover-connection.md and hardcover-sync.md.
 */

export const HARDCOVER_GRAPHQL_URL = "https://api.hardcover.app/v1/graphql";

/** Their docs ask scripts to identify themselves. */
const USER_AGENT = "Grimoire (grimoire-books; +https://github.com/mikevalstar/grimoire-books)";

// Their ceiling is 30s; anything near it means something is wrong, not slow.
const REQUEST_TIMEOUT_MS = 15_000;

/** Shelf entries per request. Paged with limit/offset — their API has no cursor. */
export const PAGE_SIZE = 100;

/**
 * Build the Authorization value. Hardcover's own settings page hands out a
 * token with `Bearer ` already attached and people paste it as-is about as
 * often as not, so both forms are accepted — the alternative is sending
 * `Bearer Bearer …` and reporting a perfectly good token as unauthorized.
 */
export function hardcoverAuthHeader(token: string): string {
  // Strip any prefix that's already there and put a canonical one back, rather
  // than forwarding whatever casing was pasted: the scheme is case-insensitive
  // by RFC, but nothing is gained by finding out whether their gateway agrees.
  return `Bearer ${token.trim().replace(/^bearer\s+/i, "")}`;
}

/** Who a token belongs to. */
const ME_QUERY = `query Test {
  me {
    id
    username
  }
}`;

/**
 * One page of a reader's shelves.
 *
 * Flat by necessity: their queries are capped at **depth 3**, so the nested
 * `contributions { author { name } }` their own examples use is unavailable and
 * the book's `cached_*` JSON columns carry that information one level shallower.
 *
 * `distinct_on: book_id` collapses the several entries a book can accumulate
 * (re-reads, merges) into the one the mirror is keyed by, and doubles as the
 * ordering that makes offset paging stable.
 */
/**
 * The series a book is in, as much of it as the depth limit allows.
 *
 * A query rooted at `books` can afford the nested series; one rooted at
 * `user_books` cannot — `user_books { book { book_series { series } } }` is
 * depth 4 — so the shelf sweep asks for `series_id` alone and hydrates the ids
 * afterwards (see `fetchSeries`). Both shapes parse to the same thing.
 */
const BOOK_SERIES_FIELDS = `book_series {
      series_id
      position
      featured
      compilation
      series {
        id
        name
        slug
        books_count
        canonical_id
      }
    }`;

const USER_BOOK_FIELDS = `
    id
    book_id
    status_id
    rating
    owned
    read_count
    date_added
    first_read_date
    last_read_date
    updated_at
    book {
      id
      title
      subtitle
      description
      pages
      release_date
      slug
      cached_contributors
      cached_image
      cached_tags
      book_series {
        series_id
        position
        featured
        compilation
      }
    }`;

const LIBRARY_QUERY = `query Library($userId: Int!, $limit: Int!, $offset: Int!) {
  user_books(
    where: { user_id: { _eq: $userId } }
    distinct_on: book_id
    limit: $limit
    offset: $offset
  ) {${USER_BOOK_FIELDS}
  }
}`;

/** One shelf entry by its id — how a just-created entry gets into the mirror. */
const USER_BOOK_QUERY = `query UserBook($id: Int!) {
  user_books(where: { id: { _eq: $id } }) {${USER_BOOK_FIELDS}
  }
}`;

type QueryResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Run one GraphQL request and answer rather than throw: every failure here is
 * something a reader can act on, and each has a different fix, so they are kept
 * apart instead of collapsed into "couldn't connect".
 */
async function hardcoverQuery<S extends z.ZodType>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
  schema: S,
): Promise<QueryResult<z.infer<S>>> {
  if (!token.trim()) return { ok: false, error: "No Hardcover token." };

  let res: Response;
  try {
    res = await fetch(HARDCOVER_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: hardcoverAuthHeader(token),
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    return {
      ok: false,
      error: `Could not reach Hardcover (${err instanceof Error ? err.message : String(err)})`,
    };
  }

  const body = await res.json().catch(() => null);
  const parsed = schema.safeParse(body);
  // Their gateway explains itself in the body for the cases that matter most —
  // an expired token, a rate limit — so prefer that over restating the status.
  const envelope = ErrorEnvelopeSchema.safeParse(body);
  const reported = envelope.success
    ? (envelope.data.error ?? envelope.data.errors?.[0]?.message)
    : null;

  if (res.status === 401) {
    return {
      ok: false,
      error: `Hardcover didn't accept that token${reported ? ` (${reported})` : ""}. Tokens expire a year after they're issued — check yours at hardcover.app/account/api.`,
    };
  }
  if (res.status === 429) {
    return {
      ok: false,
      error: "Hardcover is rate limiting us (60 requests a minute). Try again shortly.",
    };
  }
  if (!res.ok) {
    return { ok: false, error: reported ?? `Hardcover responded ${res.status} ${res.statusText}` };
  }
  // A 200 carrying `errors` is normal for GraphQL, and is still a failure.
  if (reported) return { ok: false, error: reported };
  if (!parsed.success) {
    return {
      ok: false,
      error: `Hardcover answered, but not in a shape Grimoire understands (${parsed.error.issues[0]?.path.join(".") || "root"}). Their API may have changed.`,
    };
  }

  return { ok: true, data: parsed.data };
}

// Read separately from the payload schema so an error body — which has no
// `data` at all — is still explained rather than reported as a shape mismatch.
const ErrorEnvelopeSchema = HcMeResponseSchema.pick({ error: true, errors: true });

/** Ask Hardcover who a token belongs to. The whole connection test. */
export async function probeHardcover(token: string): Promise<HardcoverTest> {
  const result = await hardcoverQuery(token, ME_QUERY, {}, HcMeResponseSchema);
  if (!result.ok) return { ok: false, error: result.error };

  // `me` is a collection, so an empty one is a token that authenticated as
  // nobody — which should not happen, and is not something to report as success.
  const me = result.data.data?.me;
  const account = Array.isArray(me) ? me[0] : me;
  if (!account) {
    return { ok: false, error: "Hardcover accepted the token but named no account for it." };
  }

  return { ok: true, username: account.username, userId: account.id };
}

/** Thrown by the sweep below; the syncer records the message against the reader. */
export class HardcoverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HardcoverError";
  }
}

// The write-backs (ADR 0014). Both target the reader's own user_books with the
// reader's own token — the only rows their token can touch anyway.

/** `numeric` is their rating type; null clears without un-shelving the book. */
const UPDATE_RATING_MUTATION = `mutation SetRating($id: Int!, $rating: numeric) {
  update_user_book(id: $id, object: { rating: $rating }) {
    error
    user_book {
      id
      rating
    }
  }
}`;

// Built with an $object variable so optional fields — the rating, and the
// finished-when as `user_date` + `finished_at_precision` — ride the same
// write. Passing dates *inline* matters: their action creates the read entry
// asynchronously, so a separate fix-the-dates call races it and ends with two
// reads (one of them stamped today).
const INSERT_USER_BOOK_MUTATION = `mutation AddToShelf($object: UserBookCreateInput!) {
  insert_user_book(object: $object) {
    error
    user_book {
      id
      status_id
      rating
    }
  }
}`;

/** A status move on its own — the corner check, marking read or unmarking. */
const SET_STATUS_MUTATION = `mutation SetStatus($id: Int!, $statusId: Int!) {
  update_user_book(id: $id, object: { status_id: $statusId }) {
    error
    user_book {
      id
      status_id
    }
  }
}`;

/**
 * Move one of the reader's shelf entries to a status, leaving the rating
 * alone (docs/features/marking-a-book-read.md). Throws a `HardcoverError`.
 */
export async function updateUserBookStatus(
  token: string,
  userBookId: number,
  statusId: number,
): Promise<void> {
  const result = await hardcoverQuery(
    token,
    SET_STATUS_MUTATION,
    { id: userBookId, statusId },
    HcUpdateUserBookResponseSchema,
  );
  if (!result.ok) throw new HardcoverError(result.error);
  const payload = result.data.data?.update_user_book;
  if (payload?.error) throw new HardcoverError(payload.error);
  if (!payload?.user_book) {
    throw new HardcoverError("Hardcover didn't change the book's status.");
  }
}

/** The mark-as-read ask, granted — same $object trick as the insert. */
const MARK_READ_MUTATION = `mutation MarkRead($id: Int!, $object: UserBookUpdateInput!) {
  update_user_book(id: $id, object: $object) {
    error
    user_book {
      id
      status_id
      rating
    }
  }
}`;

/** The optional fields a shelve or mark-read can carry along (see the mutations). */
export interface ShelfWriteExtras {
  /** Omit to leave the rating alone; a value sets it in the same write. */
  rating?: number;
  /** The finished-when at its own precision; omit for "I don't know". */
  finishedAt?: string;
}

/** The `object` fields the extras become — `user_date` is what their UI sends. */
function shelfWriteFields(extras: ShelfWriteExtras): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (extras.rating !== undefined) fields.rating = extras.rating;
  const { date, precision } = expandFinishedAt(extras.finishedAt);
  if (date !== null) {
    fields.user_date = date;
    fields.finished_at_precision = precision;
  }
  return fields;
}

/**
 * Flip one of the reader's shelf entries to Read, carrying the rating and the
 * finished-when in the same write — with `user_date` set their action edits
 * (or creates) the read entry itself, dates and precision included
 * (docs/features/rating-a-book.md, marking-a-book-read.md). Throws a
 * `HardcoverError` worth relaying.
 */
export async function markUserBookRead(
  token: string,
  userBookId: number,
  extras: ShelfWriteExtras = {},
): Promise<void> {
  const result = await hardcoverQuery(
    token,
    MARK_READ_MUTATION,
    { id: userBookId, object: { status_id: 3, ...shelfWriteFields(extras) } },
    HcUpdateUserBookResponseSchema,
  );
  if (!result.ok) throw new HardcoverError(result.error);
  const payload = result.data.data?.update_user_book;
  if (payload?.error) throw new HardcoverError(payload.error);
  if (!payload?.user_book) {
    throw new HardcoverError("Hardcover didn't mark the book as read.");
  }
}

/**
 * Set — or with null, clear — the rating on one of the reader's shelf entries.
 * Resolves on success, throws a `HardcoverError` a rating route can put in
 * front of the reader.
 */
export async function updateUserBookRating(
  token: string,
  userBookId: number,
  rating: number | null,
): Promise<void> {
  const result = await hardcoverQuery(
    token,
    UPDATE_RATING_MUTATION,
    { id: userBookId, rating },
    HcUpdateUserBookResponseSchema,
  );
  if (!result.ok) throw new HardcoverError(result.error);
  const payload = result.data.data?.update_user_book;
  if (payload?.error) throw new HardcoverError(payload.error);
  if (!payload?.user_book) {
    throw new HardcoverError("Hardcover didn't apply the rating. It may have been un-shelved.");
  }
}

/**
 * Put a book on the reader's shelves — the step rating or marking an unshelved
 * book needs first, taken only after they've confirmed it (ADR 0014). The
 * rating and finished-when ride the same write; see the mutation for why.
 * Returns the new `user_books` id, which is what later mutations target.
 */
export async function insertUserBook(
  token: string,
  hardcoverBookId: number,
  statusId: number,
  extras: ShelfWriteExtras = {},
): Promise<number> {
  const result = await hardcoverQuery(
    token,
    INSERT_USER_BOOK_MUTATION,
    { object: { book_id: hardcoverBookId, status_id: statusId, ...shelfWriteFields(extras) } },
    HcInsertUserBookResponseSchema,
  );
  if (!result.ok) throw new HardcoverError(result.error);
  const payload = result.data.data?.insert_user_book;
  if (payload?.error) throw new HardcoverError(payload.error);
  const id = payload?.user_book?.id;
  if (!id) throw new HardcoverError("Hardcover didn't add the book to the shelves.");
  return id;
}

// The finished-when answer (docs/features/rating-a-book.md,
// marking-a-book-read.md). A *known* date rides the shelve or mark-read write
// itself, above. "I don't know" is the one case left: their action creates a
// read entry stamped today — asynchronously, some seconds later — and the
// canonical unknown is a read with no dates and precision 0, so the stamp has
// to be found and cleared after the fact.
//
// `finished_at_precision` is how Hardcover keeps "sometime in": undocumented
// but introspectable, and what their own UI writes. 0 = no date, 1 = the exact
// day, 2 = a month (stored as its 1st), 3 = a year (stored as Jan 1). Without
// it a first-of-period date reads back as that literal day.

const USER_BOOK_READS_QUERY = `query Reads($id: Int!) {
  user_books(where: { id: { _eq: $id } }) {
    user_book_reads(order_by: { id: desc }, limit: 1) {
      id
    }
  }
}`;

const READING_HISTORY_QUERY = `query ReadingHistory($id: Int!) {
  user_books(where: { id: { _eq: $id } }) {
    user_book_reads(order_by: { id: desc }) {
      id
      finished_at
      finished_at_precision
    }
  }
}`;

/**
 * Every known finish date for a shelf entry, read live from Hardcover. Their
 * precision is significant: the first of a month may mean only that month.
 */
export async function fetchReadingHistory(token: string, userBookId: number): Promise<string[]> {
  const result = await hardcoverQuery(
    token,
    READING_HISTORY_QUERY,
    { id: userBookId },
    HcReadingHistoryResponseSchema,
  );
  if (!result.ok) throw new HardcoverError(result.error);

  return (result.data.data?.user_books?.[0]?.user_book_reads ?? []).flatMap((read) => {
    const date = read.finished_at?.slice(0, 10);
    if (!date || read.finished_at_precision === 0) return [];
    if (read.finished_at_precision === 3) return [date.slice(0, 4)];
    if (read.finished_at_precision === 2) return [date.slice(0, 7)];
    return [date];
  });
}

/**
 * The reader told us they don't know when they finished — so the whole stamp
 * goes, start date included, leaving the canonical no-dates read.
 */
const CLEAR_READ_DATES_MUTATION = `mutation ClearReadDates($id: Int!) {
  update_user_book_read(id: $id, object: { started_at: null, finished_at: null, finished_at_precision: 0 }) {
    error
    user_book_read {
      id
    }
  }
}`;

/**
 * A reduced-precision answer ("2023", "2023-06", "2023-06-15", or none) as the
 * pair their API stores: the first day of the period, and the precision that
 * says how much of it the reader actually knew.
 */
export function expandFinishedAt(finishedAt: string | undefined): {
  date: string | null;
  precision: number;
} {
  if (!finishedAt) return { date: null, precision: 0 };
  const [year, month, day] = finishedAt.split("-");
  return {
    date: `${year}-${month ?? "01"}-${day ?? "01"}`,
    precision: day ? 1 : month ? 2 : 3,
  };
}

/** How long the async read entry gets to show up before we stop looking. */
const READ_APPEAR_ATTEMPTS = 4;
const READ_APPEAR_DELAY_MS = 1_000;

/**
 * Clear the today their action stamps on a just-created read entry — the
 * "I don't know" answer. Polls, because the entry appears asynchronously;
 * if it never does, there is nothing to clear. Only the *newest* read is
 * touched: a re-read's earlier entries are history, not ours to edit.
 * Throws a `HardcoverError`; the caller decides how fatal that is.
 */
export async function clearReadDates(token: string, userBookId: number): Promise<void> {
  for (let attempt = 0; attempt < READ_APPEAR_ATTEMPTS; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, READ_APPEAR_DELAY_MS));

    const found = await hardcoverQuery(
      token,
      USER_BOOK_READS_QUERY,
      { id: userBookId },
      HcUserBookReadsResponseSchema,
    );
    if (!found.ok) throw new HardcoverError(found.error);
    const read = found.data.data?.user_books?.[0]?.user_book_reads?.[0];
    if (!read) continue;

    const cleared = await hardcoverQuery(
      token,
      CLEAR_READ_DATES_MUTATION,
      { id: read.id },
      HcUpdateUserBookReadResponseSchema,
    );
    if (!cleared.ok) throw new HardcoverError(cleared.error);
    const payload = cleared.data.data?.update_user_book_read;
    if (payload?.error) throw new HardcoverError(payload.error);
    return;
  }
}

// The finder's search (docs/features/rating-a-book.md). Their catalogue search
// answers ids only, so a second query hydrates them into books.

const SEARCH_QUERY = `query Search($query: String!, $perPage: Int!) {
  search(query: $query, query_type: "Book", per_page: $perPage, page: 1) {
    ids
  }
}`;

const BOOKS_BY_IDS_QUERY = `query Books($ids: [Int!]) {
  books(where: { id: { _in: $ids } }) {
    id
    title
    subtitle
    description
    pages
    release_date
    slug
    cached_contributors
    cached_image
    cached_tags
    ${BOOK_SERIES_FIELDS}
  }
}`;

/**
 * Every book in one series, with each book's place in it — the roster the
 * dialog matches against the shelf
 * (docs/features/setting-a-series-from-hardcover.md).
 *
 * Rooted at `book_series` rather than at `series`, so the join's own `position`
 * is a field of the result rather than a level deeper. `cached_contributors` is
 * how the authors come across within the depth limit, exactly as elsewhere.
 */
const SERIES_ROSTER_QUERY = `query Roster($seriesId: Int!, $limit: Int!) {
  book_series(
    where: { series_id: { _eq: $seriesId } }
    order_by: { position: asc }
    limit: $limit
  ) {
    position
    featured
    book {
      id
      title
      cached_contributors
    }
  }
}`;

/**
 * A stop rather than a target. The longest real series run to a few hundred;
 * past this something is wrong with the query, and a roster nobody can read is
 * not worth the request.
 */
export const ROSTER_LIMIT = 500;

/** Series by id — the second half of the shelf sweep's two-step (see above). */
const SERIES_BY_IDS_QUERY = `query Series($ids: [Int!]) {
  series(where: { id: { _in: $ids } }) {
    id
    name
    slug
    books_count
    canonical_id
  }
}`;

/** How many finder results are worth showing — one screen's worth of candidates. */
export const SEARCH_PAGE_SIZE = 10;

/**
 * Search Hardcover's catalogue, answering hydrated books in the relevance
 * order the search named them. Throws a `HardcoverError` worth relaying.
 */
export async function searchHardcoverBooks(token: string, query: string): Promise<HcBook[]> {
  const found = await hardcoverQuery(
    token,
    SEARCH_QUERY,
    { query, perPage: SEARCH_PAGE_SIZE },
    HcSearchResponseSchema,
  );
  if (!found.ok) throw new HardcoverError(found.error);

  const ids = (found.data.data?.search?.ids ?? [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return [];

  const hydrated = await hardcoverQuery(token, BOOKS_BY_IDS_QUERY, { ids }, HcBooksResponseSchema);
  if (!hydrated.ok) throw new HardcoverError(hydrated.error);

  // `_in` answers in its own order; the search's order is the relevance.
  const byId = new Map((hydrated.data.data?.books ?? []).map((book) => [book.id, book]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/**
 * One catalogue book by its id, read live — what an open details panel asks
 * for when it wants Hardcover's description, tags or moods
 * (docs/features/book-details-panel.md). The same hydrate query the finder
 * uses, with one id: it already carries every field this needs.
 * Null when Hardcover doesn't answer with the book; the panel falls back to
 * Calibre, which is a better outcome than an error on a read-out.
 */
export async function fetchHardcoverBook(token: string, bookId: number): Promise<HcBook | null> {
  const result = await hardcoverQuery(
    token,
    BOOKS_BY_IDS_QUERY,
    { ids: [bookId] },
    HcBooksResponseSchema,
  );
  if (!result.ok) throw new HardcoverError(result.error);
  return result.data.data?.books?.[0] ?? null;
}

/**
 * One shelf entry by its id — fetched right after `insertUserBook` so the
 * mirror can hold the full row without waiting for the next sweep. Null when
 * Hardcover doesn't answer with it, which the caller treats as "the next sync
 * will catch up".
 */
export async function fetchUserBook(token: string, userBookId: number): Promise<HcUserBook | null> {
  const result = await hardcoverQuery(
    token,
    USER_BOOK_QUERY,
    { id: userBookId },
    HcLibraryResponseSchema,
  );
  if (!result.ok) return null;
  return result.data.data?.user_books?.[0] ?? null;
}

/**
 * Hydrate the series ids a shelf page carried into the series themselves, and
 * write them onto the entries in place — so everything downstream reads one
 * shape whether the books came from a shelf sweep or from a `books` query
 * (ADR 0019).
 *
 * Silent on failure: a page whose series could not be named still mirrors the
 * books, and the next sweep tries again. Losing a whole page of somebody's
 * shelves over a series name would be a poor trade.
 */
export async function hydrateSeries(token: string, entries: readonly HcUserBook[]): Promise<void> {
  const ids = [
    ...new Set(
      entries.flatMap((entry) =>
        (entry.book.book_series ?? []).flatMap((link) => link.series_id ?? link.series?.id ?? []),
      ),
    ),
  ];
  if (ids.length === 0) return;

  const result = await hardcoverQuery(token, SERIES_BY_IDS_QUERY, { ids }, HcSeriesResponseSchema);
  if (!result.ok) return;

  const byId = new Map((result.data.data?.series ?? []).map((series) => [series.id, series]));
  for (const entry of entries) {
    for (const link of entry.book.book_series ?? []) {
      const id = link.series_id ?? link.series?.id;
      const series = id === undefined || id === null ? undefined : byId.get(id);
      if (series) link.series = series;
    }
  }
}

/**
 * Every book in a series, in position order. Throws a `HardcoverError` worth
 * relaying: unlike the read-outs above, this one was asked for by a person who
 * pressed something and is owed an answer either way.
 */
export async function fetchSeriesRoster(
  token: string,
  seriesId: number,
): Promise<HcSeriesRosterEntry[]> {
  const result = await hardcoverQuery(
    token,
    SERIES_ROSTER_QUERY,
    { seriesId, limit: ROSTER_LIMIT },
    HcSeriesRosterResponseSchema,
  );
  if (!result.ok) throw new HardcoverError(result.error);
  return result.data.data?.book_series ?? [];
}

/** One page of a reader's shelves, oldest book id first. */
export async function fetchShelfPage(
  token: string,
  userId: number,
  offset: number,
): Promise<HcUserBook[]> {
  const result = await hardcoverQuery(
    token,
    LIBRARY_QUERY,
    { userId, limit: PAGE_SIZE, offset },
    HcLibraryResponseSchema,
  );
  if (!result.ok) throw new HardcoverError(result.error);
  return result.data.data?.user_books ?? [];
}
