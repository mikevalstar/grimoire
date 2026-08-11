import type { CalibreServerTest } from "@grimoire/core";
import {
  CalibreTestRequestSchema,
  DuplicateUserError,
  openDatabase,
  PREF_KEYS,
  PreferencesUpdateSchema,
  RatingsStore,
  RatingUpdateSchema,
  SettingsStore,
  USER_HEADER,
  UserCreateSchema,
  UsersStore,
} from "@grimoire/core";
import { zValidator } from "@hono/zod-validator";
import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";

export interface ApiOptions {
  /**
   * Fallback base URL for the Calibre content server, used until the user
   * saves one in preferences. Defaults to $CALIBRE_SERVER or http://localhost:8080.
   */
  calibreServerUrl?: string;
  /** Path to Grimoire's own SQLite database. Defaults to the per-platform data dir. */
  databasePath?: string;
  /** Enable permissive CORS — needed when the UI is served from a views:// origin (desktop). */
  cors?: boolean;
}

const CALIBRE_PROBE_TIMEOUT_MS = 5_000;

/**
 * zValidator hook: report a schema failure in our usual `{ error }` shape,
 * naming the field that broke rather than dumping the whole Zod tree.
 */
const invalid: Parameters<typeof zValidator>[2] = (result, c) => {
  if (result.success) return;
  const issue = result.error.issues[0];
  const where = issue?.path.join(".");
  return c.json(
    { error: where ? `${where}: ${issue?.message}` : (issue?.message ?? "Invalid request body") },
    400,
  );
};

/** Probe a Calibre content server by asking it for a single book id. */
async function probeCalibreServer(baseUrl: string): Promise<CalibreServerTest> {
  let probe: URL;
  try {
    probe = new URL("./ajax/search?num=1", `${baseUrl.replace(/\/+$/, "")}/`);
  } catch {
    return { ok: false, error: `"${baseUrl}" is not a valid URL.` };
  }

  let res: Response;
  try {
    res = await fetch(probe, { signal: AbortSignal.timeout(CALIBRE_PROBE_TIMEOUT_MS) });
  } catch (err) {
    return {
      ok: false,
      error: `Could not reach ${baseUrl} (${err instanceof Error ? err.message : String(err)})`,
    };
  }

  if (!res.ok) {
    return { ok: false, error: `${baseUrl} responded ${res.status} ${res.statusText}` };
  }

  try {
    const body = (await res.json()) as { total_num?: number };
    if (typeof body.total_num !== "number") throw new Error("unexpected response");
    return { ok: true, bookCount: body.total_num };
  } catch {
    return {
      ok: false,
      error: `${baseUrl} answered, but not like a Calibre content server. Check the URL and that the content server is running.`,
    };
  }
}

// Hop-by-hop / encoding headers that must not be forwarded verbatim (fetch
// already decompresses the body, so passing content-encoding through would
// corrupt the response).
const STRIP_RESPONSE_HEADERS = [
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
];

/**
 * The Grimoire API as a Hono app. Embedded by both the desktop app and the
 * standalone server so every deployment mode speaks the same HTTP API.
 *
 * Library data comes from a running Calibre content server via the /api/cs
 * proxy — we never open metadata.db ourselves.
 */
export function createApi(options: ApiOptions = {}) {
  const app = new Hono();

  if (options.cors) {
    app.use("/api/*", cors());
  }

  // Opened lazily so the server can start before anything is configured, and
  // shared by every store so they see one connection and one migration pass.
  let db: ReturnType<typeof openDatabase> | null = null;
  let settings: SettingsStore | null = null;
  let users: UsersStore | null = null;
  let ratings: RatingsStore | null = null;
  const getDb = () => (db ??= openDatabase(options.databasePath));
  const getSettings = (): SettingsStore => (settings ??= new SettingsStore(getDb()));
  const getUsers = (): UsersStore => (users ??= new UsersStore(getDb()));
  const getRatings = (): RatingsStore => (ratings ??= new RatingsStore(getDb()));

  /**
   * The reader a user-scoped request is acting as (ADR 0008). No header, a
   * header that isn't a number, or one naming a reader who doesn't exist are
   * all refusals — never a silent fall back to the first reader, which would
   * quietly file one person's data under another's.
   */
  const requireUser = (c: Context): number => {
    const header = c.req.header(USER_HEADER);
    if (!header) {
      throw new HTTPException(400, {
        message: `This request has to say who it's for — send the ${USER_HEADER} header.`,
      });
    }

    const id = Number(header);
    if (!Number.isInteger(id) || id <= 0 || !getUsers().get(id)) {
      throw new HTTPException(400, { message: `No reader with id "${header}".` });
    }
    return id;
  };

  app.onError((err, c) => {
    // Hono raises these for client-side faults it catches before us — a body
    // that isn't JSON at all, for one. Keep the status and our { error } shape
    // rather than reporting someone else's bad request as our 500.
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status);
    }
    console.error(err);
    return c.json({ error: "Internal server error" }, 500);
  });

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.get("/api/preferences", (c) => c.json(getSettings().all()));

  // Merge-update: only the keys sent are touched. Values must be strings.
  app.put("/api/preferences", zValidator("json", PreferencesUpdateSchema, invalid), (c) => {
    const store = getSettings();
    store.setMany(c.req.valid("json"));
    return c.json(store.all());
  });

  // The people sharing this library (ADR 0008). Created by the setup wizard;
  // editing and deleting wait for a settings surface.
  app.get("/api/users", (c) => c.json(getUsers().list()));

  app.post("/api/users", zValidator("json", UserCreateSchema, invalid), (c) => {
    try {
      return c.json(getUsers().create(c.req.valid("json")), 201);
    } catch (err) {
      if (err instanceof DuplicateUserError) return c.json({ error: err.message }, 409);
      throw err;
    }
  });

  // The current reader's own stars, kept here rather than pushed back to
  // Calibre (docs/features/rating-a-book.md). User-scoped, so both routes
  // insist on the header.
  app.get("/api/ratings", (c) => c.json(getRatings().forUser(requireUser(c))));

  app.put("/api/ratings/:bookId", zValidator("json", RatingUpdateSchema, invalid), (c) => {
    const userId = requireUser(c);
    const bookId = Number(c.req.param("bookId"));
    if (!Number.isInteger(bookId) || bookId <= 0) {
      return c.json({ error: `"${c.req.param("bookId")}" is not a book id.` }, 400);
    }

    // Calibre ids aren't checked against the content server: it may be down,
    // and a rating for a book that has gone away is a stale row, not an error.
    const rating = getRatings().set(userId, bookId, c.req.valid("json").rating);
    return c.json({ bookId, rating });
  });

  // Probe a candidate content server (from the setup wizard's Test button)
  // before the user commits to it. Runs server-side, so no CORS involved.
  app.post(
    "/api/calibre/test",
    zValidator("json", CalibreTestRequestSchema, invalid),
    async (c) => {
      const { url } = c.req.valid("json");
      const target = url?.trim() ? url.trim() : resolveCalibreServerUrl();
      return c.json(await probeCalibreServer(target));
    },
  );

  // Reverse proxy to the Calibre content server: /api/cs/<path> → <server>/<path>.
  // e.g. /api/cs/ajax/search?num=50, /api/cs/ajax/books?ids=1,2, /api/cs/get/thumb/1/Calibre_Library
  const fallbackCalibreServerUrl =
    options.calibreServerUrl ?? process.env.CALIBRE_SERVER ?? "http://localhost:8080";

  // Read per request so saving the preference takes effect without a restart.
  const resolveCalibreServerUrl = (): string =>
    getSettings().get(PREF_KEYS.calibreServerUrl) || fallbackCalibreServerUrl;

  app.all("/api/cs/*", async (c) => {
    const calibreServerUrl = resolveCalibreServerUrl();
    const url = new URL(c.req.url);
    const target = new URL(url.pathname.replace(/^\/api\/cs/, "") + url.search, calibreServerUrl);

    const headers = new Headers(c.req.raw.headers);
    headers.delete("host");

    let upstream: Response;
    try {
      upstream = await fetch(target, {
        method: c.req.method,
        headers,
        body: c.req.raw.body,
      });
    } catch {
      return c.json(
        {
          error: `Could not reach the Calibre content server at ${calibreServerUrl}`,
          hint: "Start it with `calibre-server` (or calibre Preferences → Sharing over the net), then check the content server URL in Grimoire's settings.",
        },
        502,
      );
    }

    const responseHeaders = new Headers(upstream.headers);
    for (const h of STRIP_RESPONSE_HEADERS) responseHeaders.delete(h);
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  });

  // Unknown /api paths answer JSON, not the hosted server's SPA fallback.
  app.all("/api/*", (c) => c.json({ error: `No such endpoint: ${c.req.path}` }, 404));

  return app;
}

export type GrimoireApi = ReturnType<typeof createApi>;
