import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  CalibreLibrary,
  LibraryNotFoundError,
  defaultLibraryPath,
} from "@grimoire/core";
import type { BookList } from "@grimoire/core";

export interface ApiOptions {
  /** Path to the Calibre library directory. Defaults to $CALIBRE_LIBRARY or ~/Calibre Library. */
  libraryPath?: string;
  /** Base URL of a running Calibre content server. Defaults to $CALIBRE_SERVER or http://localhost:8080. */
  calibreServerUrl?: string;
  /** Enable permissive CORS — needed when the UI is served from a views:// origin (desktop). */
  cors?: boolean;
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

  // Reverse proxy to the Calibre content server: /api/cs/<path> → <server>/<path>.
  // e.g. /api/cs/ajax/search?num=50, /api/cs/ajax/books?ids=1,2, /api/cs/get/thumb/1/Calibre_Library
  const calibreServerUrl =
    options.calibreServerUrl ?? process.env.CALIBRE_SERVER ?? "http://localhost:8080";

  app.all("/api/cs/*", async (c) => {
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
          hint: "Start it with `calibre-server` (or calibre Preferences → Sharing over the net), or set CALIBRE_SERVER to its URL.",
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
