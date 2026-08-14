import {
  type HardcoverTest,
  HcLibraryResponseSchema,
  HcMeResponseSchema,
  type HcUserBook,
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
const LIBRARY_QUERY = `query Library($userId: Int!, $limit: Int!, $offset: Int!) {
  user_books(
    where: { user_id: { _eq: $userId } }
    distinct_on: book_id
    limit: $limit
    offset: $offset
  ) {
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
    }
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
