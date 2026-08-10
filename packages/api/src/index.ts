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
  /** Enable permissive CORS — needed when the UI is served from a views:// origin (desktop). */
  cors?: boolean;
}

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
