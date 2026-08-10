import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  CalibreLibrary,
  LibraryNotFoundError,
  PREF_KEYS,
  SettingsStore,
  defaultLibraryPath,
} from "@grimoire/core";
import type { BookList, CalibreServerTest, Preferences } from "@grimoire/core";

export interface ApiOptions {
  /** Path to the Calibre library directory. Defaults to $CALIBRE_LIBRARY or ~/Calibre Library. */
  libraryPath?: string;
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
const STRIP_RESPONSE_HEADERS = ["content-encoding", "content-length", "transfer-encoding", "connection"];

/**
 * The Grimoire API as a Hono app. Embedded by both the desktop app and the
 * standalone server so every deployment mode speaks the same HTTP API.
 */
export function createApi(options: ApiOptions = {}) {
  const app = new Hono();
  const libraryPath = options.libraryPath ?? defaultLibraryPath();

  if (options.cors) {
    app.use("/api/*", cors());
  }

  // Opened lazily so the server can start (and report a friendly error)
  // before a library has been configured.
  let library: CalibreLibrary | null = null;
  const getLibrary = (): CalibreLibrary => {
    library ??= new CalibreLibrary(libraryPath);
    return library;
  };

  let settings: SettingsStore | null = null;
  const getSettings = (): SettingsStore => {
    settings ??= new SettingsStore(options.databasePath);
    return settings;
  };

  app.onError((err, c) => {
    if (err instanceof LibraryNotFoundError) {
      return c.json(
        { error: err.message, hint: "Set CALIBRE_LIBRARY to your Calibre library directory." },
        503,
      );
    }
    console.error(err);
    return c.json({ error: "Internal server error" }, 500);
  });

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.get("/api/preferences", (c) => c.json(getSettings().all()));

  // Merge-update: only the keys sent are touched. Values must be strings.
  app.put("/api/preferences", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Expected a JSON object of preferences" }, 400);
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return c.json({ error: "Expected a JSON object of preferences" }, 400);
    }
    const entries = Object.entries(body as Record<string, unknown>);
    const bad = entries.find(([, value]) => typeof value !== "string");
    if (bad) {
      return c.json({ error: `Preference "${bad[0]}" must be a string` }, 400);
    }

    const store = getSettings();
    store.setMany(Object.fromEntries(entries) as Preferences);
    return c.json(store.all());
  });

  // Probe a candidate content server (from the setup dialog's Test button)
  // before the user commits to it. Runs server-side, so no CORS involved.
  app.post("/api/calibre/test", async (c) => {
    let url: unknown;
    try {
      ({ url } = (await c.req.json()) as { url?: unknown });
    } catch {
      /* fall through to the stored/default URL */
    }
    const target = typeof url === "string" && url.trim() ? url.trim() : resolveCalibreServerUrl();
    return c.json(await probeCalibreServer(target));
  });

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

  app.get("/api/library", (c) => c.json(getLibrary().info()));

  app.get("/api/books", (c) => {
    const search = c.req.query("search");
    const limit = Number(c.req.query("limit") ?? 100);
    const offset = Number(c.req.query("offset") ?? 0);
    const { books, total } = getLibrary().listBooks({ search, limit, offset });
    const body: BookList = { books, total, limit, offset };
    return c.json(body);
  });

  app.get("/api/books/:id", (c) => {
    const book = getLibrary().getBook(Number(c.req.param("id")));
    if (!book) return c.json({ error: "Book not found" }, 404);
    return c.json(book);
  });

  app.get("/api/books/:id/cover", async (c) => {
    const lib = getLibrary();
    const book = lib.getBook(Number(c.req.param("id")));
    if (!book?.hasCover) return c.json({ error: "No cover" }, 404);
    const file = Bun.file(lib.coverPath(book));
    if (!(await file.exists())) return c.json({ error: "No cover" }, 404);
    return new Response(file, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  });

  return app;
}

export type GrimoireApi = ReturnType<typeof createApi>;
