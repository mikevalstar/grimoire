import type { CalibreServerTest, HardcoverContent, User } from "@grimoire/core";
import {
  BooksStore,
  CalibreTestRequestSchema,
  CoverChoiceSchema,
  type CoverSize,
  CoverStore,
  DuplicateDismissSchema,
  DuplicateLinkSchema,
  DuplicateUserError,
  defaultDataDir,
  HardcoverAddSchema,
  HardcoverBooksStore,
  HardcoverLinkSchema,
  HardcoverSearchRequestSchema,
  HardcoverTestRequestSchema,
  hardcoverAuthors,
  hardcoverBookUrl,
  hardcoverCoverUrl,
  hardcoverTagsByCategory,
  isCoverSize,
  openDatabase,
  PREF_KEYS,
  PreferencesUpdateSchema,
  RatingsStore,
  RatingUpdateSchema,
  ReadStatesStore,
  ReadStateUpdateSchema,
  SettingsStore,
  SyncSettingsUpdateSchema,
  USER_HEADER,
  UserCreateSchema,
  UserSettingsSchema,
  UsersStore,
  WorkSeparateSchema,
  WorksStore,
} from "@grimoire/core";
import { zValidator } from "@hono/zod-validator";
import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { refetchWorkCovers } from "./covers.ts";
import {
  clearReadDates,
  fetchHardcoverBook,
  fetchReadingHistory,
  fetchUserBook,
  HardcoverError,
  insertUserBook,
  markUserBookRead,
  probeHardcover,
  searchHardcoverBooks,
  updateUserBookRating,
  updateUserBookStatus,
} from "./hardcover.ts";
import { HardcoverSync } from "./hardcover-sync.ts";
import { CalibreSync } from "./sync.ts";

export { HardcoverSync } from "./hardcover-sync.ts";
export { CalibreSync } from "./sync.ts";

export interface ApiOptions {
  /**
   * Fallback base URL for the Calibre content server, used until the user
   * saves one in preferences. Defaults to $CALIBRE_SERVER or http://localhost:8080.
   */
  calibreServerUrl?: string;
  /** Path to Grimoire's own SQLite database. Defaults to the per-platform data dir. */
  databasePath?: string;
  /** Where cached covers live. Defaults to the per-platform data dir (ADR 0007). */
  dataDir?: string;
  /** Enable permissive CORS — needed when the UI is served from a views:// origin (desktop). */
  cors?: boolean;
  /**
   * Start the Calibre sync scheduler (ADR 0011). On by default; turn it off for
   * tests, or anywhere a second process is already syncing the same database.
   */
  sync?: boolean;
}

const CALIBRE_PROBE_TIMEOUT_MS = 5_000;

/** The year out of Hardcover's `release_date` (ISO-ish), for the finder's rows. */
function releaseYearOf(releaseDate: string | null | undefined): number | null {
  const year = Number(releaseDate?.slice(0, 4));
  return Number.isInteger(year) && year > 0 ? year : null;
}

/**
 * The "I don't know" answer: clear the today their action stamps on the read
 * entry it creates (docs/features/rating-a-book.md). A *known* date rides the
 * shelve or mark-read write itself and needs no follow-up. Never fatal: by now
 * the book is shelved, and failing the whole request over its dates would roll
 * back a write that actually landed.
 */
async function clearDefaultReadDates(token: string, userBookId: number): Promise<void> {
  await clearReadDates(token, userBookId).catch(() => {});
}

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
  let readStates: ReadStatesStore | null = null;
  let books: BooksStore | null = null;
  let sync: CalibreSync | null = null;
  let hardcover: HardcoverSync | null = null;
  let hardcoverBooks: HardcoverBooksStore | null = null;
  let works: WorksStore | null = null;
  const getDb = () => (db ??= openDatabase(options.databasePath));
  const getSettings = (): SettingsStore => (settings ??= new SettingsStore(getDb()));
  const getUsers = (): UsersStore => (users ??= new UsersStore(getDb()));
  const getRatings = (): RatingsStore => (ratings ??= new RatingsStore(getDb()));
  const getReadStates = (): ReadStatesStore => (readStates ??= new ReadStatesStore(getDb()));
  const getBooks = (): BooksStore => (books ??= new BooksStore(getDb()));

  const dataDir = options.dataDir ?? defaultDataDir();
  const covers = new CoverStore(dataDir);

  const getSync = (): CalibreSync =>
    (sync ??= new CalibreSync({
      db: getDb(),
      calibreServerUrl: () => resolveCalibreServerUrl(),
      dataDir,
    }));

  const getHardcoverSync = (): HardcoverSync => (hardcover ??= new HardcoverSync(getDb(), dataDir));
  const getHardcoverBooks = (): HardcoverBooksStore =>
    (hardcoverBooks ??= new HardcoverBooksStore(getDb()));
  const getWorks = (): WorksStore => (works ??= new WorksStore(getDb()));

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

  /**
   * The reader named by a `:id` path segment. Distinct from `requireUser`,
   * which asks who is *making* the request: linking a Hardcover account is
   * administering a particular reader, who is not always the one at the
   * keyboard (ADR 0012).
   */
  const readerFromPath = (c: Context): User => {
    const raw = c.req.param("id");
    const id = Number(raw);
    const user = Number.isInteger(id) && id > 0 ? getUsers().get(id) : null;
    if (!user) throw new HTTPException(404, { message: `No reader with id "${raw}".` });
    return user;
  };

  /**
   * The work a `:id` path segment names. Every book route speaks work ids
   * (ADR 0013); this only proves it is one, not that it exists.
   */
  const workIdFromPath = (c: Context): number => {
    const raw = c.req.param("id");
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      throw new HTTPException(400, { message: `"${raw}" is not a book id.` });
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
    const before = store.get(PREF_KEYS.calibreServerUrl);
    store.setMany(c.req.valid("json"));

    // A new content server is a new library to mirror; don't make the user wait
    // out an interval to see it.
    if (store.get(PREF_KEYS.calibreServerUrl) !== before) {
      void getSync()
        .syncNow(true)
        .catch(() => {});
    }
    return c.json(store.all());
  });

  // The library, from Grimoire's own tables rather than Calibre (ADR 0011).
  // Answers with a stopped content server, which is most of the point.
  app.get("/api/books", (c) => c.json(getBooks().list()));

  /**
   * A cached cover, by *work* id — so a book keeps its cover after leaving
   * Calibre, and the browser never learns that either a Calibre id or a member
   * row id exists. Served from disk with a long max-age: the URL's content only
   * changes when sync rewrites the file, and the ETag catches that.
   *
   * The file is named by the *member* that holds it (ADR 0013), so the work is
   * resolved to whichever of its books actually has one.
   *
   * `?member=` asks for one particular member's cover instead of the work's
   * chosen one — how the details panel draws the covers on the bottom of the
   * stack. It is also what makes the URL change when the choice does: the
   * client stamps the chosen member on it, so a swap is not left behind a
   * year-long max-age (docs/features/book-details-panel.md).
   */
  app.get("/api/books/:id/cover/:size", async (c) => {
    const workId = Number(c.req.param("id"));
    const size = c.req.param("size");
    const member = c.req.query("member");
    if (!Number.isInteger(workId) || workId <= 0) {
      return c.json({ error: `"${c.req.param("id")}" is not a book id.` }, 400);
    }
    if (!isCoverSize(size)) {
      return c.json({ error: `"${size}" is not a cover size.` }, 400);
    }

    const books = getBooks();
    const id =
      member === undefined
        ? books.coverBookId(workId)
        : books.memberCoverBookId(workId, Number(member));
    if (id === null) {
      return c.json({ error: "No cached cover for that book." }, 404);
    }

    const file = Bun.file(covers.path(id, size as CoverSize));
    if (!(await file.exists())) {
      // Not an error: a book with no cover, or one sync hasn't reached yet. The
      // views already draw a placeholder for it.
      return c.json({ error: "No cached cover for that book." }, 404);
    }

    const etag = `W/"${id}-${size}-${file.lastModified}"`;
    if (c.req.header("if-none-match") === etag) return c.body(null, 304);

    return new Response(file, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, must-revalidate",
        ETag: etag,
      },
    });
  });

  /**
   * Choose which of a work's covers to show, for everyone
   * (docs/features/book-details-panel.md). A work only has more than one when
   * matching grouped members that each brought a cover, so this 404s for the
   * vast majority of books — and for any body naming a book that is not a
   * member of this work, or has no cached cover to show.
   */
  app.put("/api/books/:id/cover", zValidator("json", CoverChoiceSchema, invalid), (c) => {
    const workId = Number(c.req.param("id"));
    if (!Number.isInteger(workId) || workId <= 0) {
      return c.json({ error: `"${c.req.param("id")}" is not a book id.` }, 400);
    }

    const book = getBooks().chooseCover(workId, c.req.valid("json").bookId);
    if (!book) {
      return c.json({ error: "That book has no cover to show for this work." }, 404);
    }
    return c.json(book);
  });

  /**
   * Re-fetch this work's covers from every source its members have and
   * overwrite what is cached (docs/features/book-actions.md) — the first of the
   * panel's actions, and the only cover path that ignores what sync believes.
   *
   * Answers with the book as it now is: its `coverVersion` has moved, which is
   * what gets the new image past the year-long `max-age` above.
   */
  app.post("/api/books/:id/cover/refetch", async (c) => {
    const workId = workIdFromPath(c);
    const books = getBooks();
    if (!books.get(workId)) return c.json({ error: "No book with that id." }, 404);

    const result = await refetchWorkCovers(
      { books, covers, calibreServerUrl: resolveCalibreServerUrl() || null },
      workId,
    );

    const book = books.get(workId);
    if (!book) return c.json({ error: "No book with that id." }, 404);
    return c.json({ book, ...result });
  });

  /**
   * Duplicate resolution, from the details panel
   * (docs/features/resolving-duplicates.md). The GET suggests, the two POSTs
   * are the reader's answer either way, and `separate` is the undo.
   *
   * A candidate carries no metadata — just the work it names — because the
   * client already holds every work from `GET /api/books`.
   */
  app.get("/api/books/:id/duplicates", (c) => {
    const duplicates = getWorks().duplicatesFor(workIdFromPath(c));
    if (!duplicates) return c.json({ error: "No book with that id." }, 404);
    return c.json(duplicates);
  });

  // These two are the same book: one work from now on, pinned so the matcher
  // never reconsiders it. Answers with the work that survived — which is the
  // older of the two, so it may not be the one in the path.
  app.post("/api/books/:id/duplicates", zValidator("json", DuplicateLinkSchema, invalid), (c) => {
    const merged = getWorks().link(workIdFromPath(c), c.req.valid("json").workId);
    if (merged === null) {
      return c.json({ error: "Those aren't two different books to join." }, 404);
    }
    const book = getBooks().get(merged);
    if (!book) return c.json({ error: "No book with that id." }, 404);
    return c.json(book);
  });

  // Not the same book. Remembered against the pair of *rows*, and honoured by
  // the matcher too — otherwise the answer would last until the next sync.
  app.post(
    "/api/books/:id/duplicates/dismiss",
    zValidator("json", DuplicateDismissSchema, invalid),
    (c) => {
      const workId = workIdFromPath(c);
      const { bookId, otherBookId } = c.req.valid("json");
      const works = getWorks();

      if (!works.ruleOut(bookId, otherBookId, new Date().toISOString())) {
        return c.json({ error: "Those aren't two books in different works." }, 404);
      }
      const duplicates = works.duplicatesFor(workId);
      if (!duplicates) return c.json({ error: "No book with that id." }, 404);
      return c.json(duplicates);
    },
  );

  // Move one entry back out on its own — the undo for a merge. The reader stays
  // on the work they were looking at, so that is what this answers with.
  app.post("/api/books/:id/separate", zValidator("json", WorkSeparateSchema, invalid), (c) => {
    const workId = workIdFromPath(c);
    if (!getWorks().separate(workId, c.req.valid("json").bookId, new Date().toISOString())) {
      return c.json({ error: "That book isn't one of this book's entries." }, 404);
    }
    const book = getBooks().get(workId);
    if (!book) return c.json({ error: "No book with that id." }, 404);
    return c.json(book);
  });

  // Sync status and control (docs/features/calibre-sync.md). The indicator polls
  // the GET; the POST is the indicator's click and settings' Sync now.
  app.get("/api/sync", (c) => c.json(getSync().status()));

  app.post("/api/sync", (c) => {
    const syncer = getSync();
    // Fire and forget: a full library can take minutes, and the client is
    // already polling for progress. Single-flight, so a second click joins the
    // run in flight rather than starting another.
    void syncer.syncNow(true).catch(() => {});
    return c.json(syncer.status(), 202);
  });

  app.put("/api/sync/settings", zValidator("json", SyncSettingsUpdateSchema, invalid), (c) => {
    getSettings().set(PREF_KEYS.syncIntervalMinutes, String(c.req.valid("json").intervalMinutes));
    // Re-arm now rather than letting the old interval fire once more first.
    getSync().reschedule();
    return c.json(getSync().status());
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

  // A reader's own settings — the rating and read-state sources (ADR 0014,
  // docs/features/marking-a-book-read.md).
  app.patch("/api/users/:id", zValidator("json", UserSettingsSchema, invalid), (c) => {
    const user = readerFromPath(c);
    const { ratingsSource, readStateSource } = c.req.valid("json");

    // A source that can't be read or written is not a choice to store — the
    // toggles only show on linked cards, so this is belt over braces.
    const wantsHardcover = ratingsSource === "hardcover" || readStateSource === "hardcover";
    if (wantsHardcover && !getUsers().hardcoverAccount(user.id)) {
      return c.json({ error: `${user.name} has no Hardcover account linked.` }, 400);
    }

    let updated = user;
    if (ratingsSource) updated = getUsers().setRatingsSource(user.id, ratingsSource) ?? updated;
    if (readStateSource) {
      updated = getUsers().setReadStateSource(user.id, readStateSource) ?? updated;
    }
    return c.json(updated);
  });

  /**
   * Look for duplicates across sources now (docs/features/book-matching.md).
   * Runs at startup too, so an existing library is grouped without anyone
   * asking — this is for after a re-sync, or for seeing what it does.
   */
  app.post("/api/match", (c) => c.json(getWorks().matchAll()));

  // The library-wide review queue: every pair the matcher refused and nobody
  // has answered (docs/features/resolving-duplicates.md). Answers go through
  // the per-book routes below, which is what removes a pair from here.
  app.get("/api/duplicates", (c) => c.json(getWorks().pendingDuplicates()));

  // A reader's link to hardcover.app (ADR 0012). Scoped by path rather than by
  // the user header for the reason above, and server-side because Hardcover's
  // API refuses browser callers — which is also what keeps the token off the
  // wire. See docs/features/hardcover-connection.md.
  app.put(
    "/api/users/:id/hardcover",
    zValidator("json", HardcoverLinkSchema, invalid),
    async (c) => {
      const user = readerFromPath(c);
      const token = c.req.valid("json").token.trim();

      // Prove it before storing it, so a saved token is always one that worked
      // and `hardcoverUsername` is always the account it actually names.
      const test = await probeHardcover(token);
      if (!test.ok || !test.username) {
        return c.json({ error: test.error ?? "Hardcover didn't accept that token." }, 400);
      }

      const linked = getUsers().linkHardcover(user.id, token, test.username, test.userId ?? 0);
      if (!linked) throw new HTTPException(404, { message: `No reader with id ${user.id}.` });

      // A newly linked account is a shelf to mirror; don't make them wait an
      // hour for the timer (docs/features/hardcover-sync.md).
      void getHardcoverSync()
        .syncUser(user.id)
        .catch(() => {});
      return c.json(linked);
    },
  );

  /**
   * Sync one reader's Hardcover shelves now. Runs to completion in the request:
   * a sweep is paced at a page a second, and there is no progress readout to
   * poll yet — so the client holds the connection and gets the result.
   */
  app.post("/api/users/:id/hardcover/sync", async (c) => {
    const user = readerFromPath(c);
    try {
      // Full: someone pressed a button, which is also how they say "the covers
      // didn't come down, try again" (docs/features/hardcover-sync.md).
      await getHardcoverSync().syncUser(user.id, true);
    } catch {
      // The reason is recorded against the reader and comes back on the row
      // below, so a failed sync answers with the reader, not with a 500.
    }
    return c.json(getUsers().get(user.id));
  });

  app.delete("/api/users/:id/hardcover", (c) => {
    const user = readerFromPath(c);
    const unlinked = getUsers().unlinkHardcover(user.id);
    if (!unlinked) throw new HTTPException(404, { message: `No reader with id ${user.id}.` });
    return c.json(unlinked);
  });

  // Probe without writing: a candidate token, or — with no token in the body —
  // the stored one, which is how an expired link gets found without pasting it
  // again. Tokens expire a year after Hardcover issues them.
  app.post(
    "/api/users/:id/hardcover/test",
    zValidator("json", HardcoverTestRequestSchema, invalid),
    async (c) => {
      const user = readerFromPath(c);
      const token =
        c.req.valid("json").token?.trim() || getUsers().hardcoverAccount(user.id)?.token;
      if (!token) {
        return c.json({ ok: false, error: `${user.name} has no Hardcover token saved.` });
      }
      return c.json(await probeHardcover(token));
    },
  );

  /**
   * The finder's search (docs/features/rating-a-book.md): Hardcover's
   * catalogue, with this reader's token — server-side, like everything that
   * touches their API. Read-only; the pick comes back through the rating PUT.
   */
  app.post(
    "/api/users/:id/hardcover/search",
    zValidator("json", HardcoverSearchRequestSchema, invalid),
    async (c) => {
      const user = readerFromPath(c);
      const account = getUsers().hardcoverAccount(user.id);
      if (!account) {
        return c.json({ error: `${user.name} has no Hardcover account linked.` }, 400);
      }

      try {
        const books = await searchHardcoverBooks(account.token, c.req.valid("json").query);
        return c.json({
          results: books.map((book) => ({
            id: book.id,
            title: book.title ?? "Untitled",
            authors: hardcoverAuthors(book.cached_contributors),
            coverUrl: hardcoverCoverUrl(book.cached_image),
            releaseYear: releaseYearOf(book.release_date),
          })),
        });
      } catch (err) {
        if (err instanceof HardcoverError) return c.json({ error: err.message }, 502);
        throw err;
      }
    },
  );

  /**
   * Shelve a Hardcover catalogue book as **Read** for a reader — with an
   * optional rating and finished-when — then mirror it, and where the pick was
   * for a work with no Hardcover edition, join it into that work pinned, so
   * the matcher never reconsiders a pairing a person made
   * (docs/features/rating-a-book.md). A background sweep follows for the cover
   * and the authoritative row.
   */
  const shelveOnHardcover = async (
    userId: number,
    token: string,
    workId: number,
    hardcoverBookId: number,
    rating: number | null,
    finishedAt: string | undefined,
  ): Promise<void> => {
    const newWork = await shelveNewHardcoverBook(userId, token, hardcoverBookId, 3, {
      rating,
      finishedAt,
    });
    if (newWork && newWork !== workId) getWorks().link(workId, newWork);
  };

  /**
   * The shelving underneath: put a catalogue book on the reader's shelves at a
   * status, mirror it, and reconcile it into the library — answering the work
   * it landed in, or null when Hardcover's read replica wouldn't hand the
   * entry back in time. On its own this is
   * docs/features/adding-a-book-from-hardcover.md; `shelveOnHardcover` above
   * adds the join into an existing work.
   */
  const shelveNewHardcoverBook = async (
    userId: number,
    token: string,
    hardcoverBookId: number,
    statusId: number,
    extras: { rating?: number | null; finishedAt?: string } = {},
  ): Promise<number | null> => {
    const { rating = null, finishedAt } = extras;
    const now = new Date().toISOString();
    const userBookId = await insertUserBook(token, hardcoverBookId, statusId, {
      rating: rating ?? undefined,
      finishedAt,
    });
    // Only a Read gets stamped with a read entry to begin with, so only a Read
    // with no answer has one to clear.
    if (statusId === 3 && !finishedAt) await clearDefaultReadDates(token, userBookId);

    // Their read replica can lag the write that just made this entry — give
    // it a few tries before settling for the minimal record.
    let shelved = await fetchUserBook(token, userBookId);
    for (let attempt = 0; !shelved && attempt < 3; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      shelved = await fetchUserBook(token, userBookId);
    }

    let workId: number | null = null;
    if (shelved) {
      getHardcoverBooks().upsert(userId, shelved, now);
      getBooks().reconcileFromHardcover(getHardcoverBooks().allBooks(), now);
      workId = getBooks().workForHardcoverId(hardcoverBookId);
    } else {
      // Hardcover accepted the writes but wouldn't answer with the entry;
      // keep what we know and let the next sweep fill in the book.
      getHardcoverBooks().recordShelfEntry(userId, hardcoverBookId, userBookId, statusId, rating);
    }

    void getHardcoverSync()
      .syncUser(userId)
      .catch(() => {});

    return workId;
  };

  /**
   * Add a book Grimoire has no side of yet: the reader picked it out of
   * Hardcover's catalogue, so shelving it there is what puts it in the library
   * (docs/features/adding-a-book-from-hardcover.md). Reader-scoped by path,
   * like the search that found it.
   */
  app.post(
    "/api/users/:id/hardcover/books",
    zValidator("json", HardcoverAddSchema, invalid),
    async (c) => {
      const user = readerFromPath(c);
      const account = getUsers().hardcoverAccount(user.id);
      if (!account) {
        return c.json({ error: `${user.name} has no Hardcover account linked.` }, 400);
      }

      const { hardcoverBookId, statusId, finishedAt } = c.req.valid("json");
      try {
        const bookId = await shelveNewHardcoverBook(
          user.id,
          account.token,
          hardcoverBookId,
          statusId,
          // A finish date belongs to a book they finished; anywhere else it is
          // an answer to a question the dialog never asked.
          { finishedAt: statusId === 3 ? finishedAt : undefined },
        );
        return c.json({ bookId });
      } catch (err) {
        if (err instanceof HardcoverError) return c.json({ error: err.message }, 502);
        throw err;
      }
    },
  );

  // The current reader's stars (docs/features/rating-a-book.md). Two sources
  // since ADR 0014 — their own rows here, or their Hardcover shelves — and
  // every route is user-scoped, so all of them insist on the header.
  app.get("/api/ratings", (c) => c.json(getRatings().forUser(requireUser(c))));

  // Their Hardcover ratings by work id, from the mirror. An entry per shelved
  // book, null where the shelf entry is unrated — presence is what tells the
  // client rating a book won't need the add-to-shelf confirmation.
  app.get("/api/ratings/hardcover", (c) =>
    c.json(getHardcoverBooks().ratingsByWork(requireUser(c))),
  );

  /**
   * What Hardcover has written about one book — description, tags and moods —
   * for an open details panel (docs/features/book-details-panel.md). Live for
   * the same reason the history below is, and stored nowhere.
   *
   * Which of the three the panel actually shows is an instance-wide preference
   * it applies itself; this route always answers with all of them. A book
   * Hardcover has nothing for, or a reader with no linked account, answers
   * empty rather than 400: the panel has Calibre's text to fall back to, and a
   * read-out is no place for an error nobody can act on.
   */
  app.get("/api/books/:bookId/hardcover", async (c) => {
    const userId = requireUser(c);
    const bookId = Number(c.req.param("bookId"));
    if (!Number.isInteger(bookId) || bookId <= 0) {
      return c.json({ error: `"${c.req.param("bookId")}" is not a book id.` }, 400);
    }
    if (!getBooks().get(bookId)) {
      return c.json({ error: `No book with id ${bookId}.` }, 404);
    }

    const account = getUsers().hardcoverAccount(userId);
    // `shelfEntryForWork` names the work's Hardcover book whether or not this
    // reader shelved it — which is what this needs; the writing about a book
    // is the catalogue's, not theirs.
    const hardcoverBookId = getHardcoverBooks().shelfEntryForWork(userId, bookId)?.hardcoverBookId;
    // The link out rides on the mirrored slug, so it is answered for a matched
    // book whether or not this reader has a token and whether or not the live
    // request below gets anywhere (docs/features/book-details-panel.md).
    const url = hardcoverBookId
      ? hardcoverBookUrl(getHardcoverBooks().slug(hardcoverBookId))
      : null;
    const empty: HardcoverContent = { about: null, tags: [], moods: [], url };
    if (!account || !hardcoverBookId) return c.json(empty);

    try {
      const book = await fetchHardcoverBook(account.token, hardcoverBookId);
      if (!book) return c.json(empty);

      const byCategory = hardcoverTagsByCategory(book.cached_tags);
      return c.json({
        about: book.description?.trim() || null,
        // Genres first: they say what the book *is*, where a tag says what it
        // was like. Content warnings are deliberately left out until there is a
        // decision about how to present them.
        tags: [...(byCategory.Genre ?? []), ...(byCategory.Tag ?? [])],
        moods: byCategory.Mood ?? [],
        // Their freshest slug where they answered with one; the mirror's
        // otherwise, since a slug they renamed still redirects.
        url: hardcoverBookUrl(book.slug) ?? url,
      } satisfies HardcoverContent);
    } catch (err) {
      if (err instanceof HardcoverError) return c.json({ error: err.message }, 502);
      throw err;
    }
  });

  /**
   * A read book's full reread history. This deliberately bypasses the mirror:
   * it is only requested for an open panel, and should be current at that
   * moment without making every shelf sync wider.
   */
  app.get("/api/books/:bookId/read-dates/hardcover", async (c) => {
    const userId = requireUser(c);
    const bookId = Number(c.req.param("bookId"));
    if (!Number.isInteger(bookId) || bookId <= 0) {
      return c.json({ error: `"${c.req.param("bookId")}" is not a book id.` }, 400);
    }
    if (!getBooks().get(bookId)) {
      return c.json({ error: `No book with id ${bookId}.` }, 404);
    }

    const account = getUsers().hardcoverAccount(userId);
    if (!account) {
      return c.json({ error: "This reader has no Hardcover account linked." }, 400);
    }
    const entry = getHardcoverBooks().shelfEntryForWork(userId, bookId);
    if (!entry?.userBookId) return c.json({ dates: [] });

    try {
      return c.json({ dates: await fetchReadingHistory(account.token, entry.userBookId) });
    } catch (err) {
      if (err instanceof HardcoverError) return c.json({ error: err.message }, 502);
      throw err;
    }
  });

  app.put("/api/ratings/:bookId", zValidator("json", RatingUpdateSchema, invalid), async (c) => {
    const userId = requireUser(c);
    const bookId = Number(c.req.param("bookId"));
    if (!Number.isInteger(bookId) || bookId <= 0) {
      return c.json({ error: `"${c.req.param("bookId")}" is not a book id.` }, 400);
    }

    // The id is a *work* id (ADR 0013), which `BooksStore.get` speaks — so this
    // is checkable, and has to be, since the row carries a foreign key.
    // Checking here turns what would be a constraint violation into a 404.
    if (!getBooks().get(bookId)) {
      return c.json({ error: `No book with id ${bookId}.` }, 404);
    }

    const { rating, source, addToShelf, hardcoverBookId, finishedAt, markRead } =
      c.req.valid("json");

    if (source === "local") {
      return c.json({ bookId, rating: getRatings().set(userId, bookId, rating) });
    }

    // Hardcover write-back (ADR 0014): the rating lands on the reader's own
    // account, with their own token, and the mirror updates in step so the
    // shelf shows it without waiting for the next sweep.
    const account = getUsers().hardcoverAccount(userId);
    if (!account) {
      return c.json({ error: "This reader has no Hardcover account linked." }, 400);
    }

    const entry = getHardcoverBooks().shelfEntryForWork(userId, bookId);
    const value = rating > 0 ? rating : null;
    try {
      if (!entry) {
        // A Calibre-only book: only the finder's pick can rate it, and picking
        // is the reader's confirmation. 409 rather than a silent fall back to
        // local, which would scatter one reader's ratings across two stores.
        if (!hardcoverBookId || !addToShelf) {
          return c.json(
            {
              error: "This book has no Hardcover edition, so there's nowhere there to rate it.",
              code: "no-hardcover-edition",
            },
            409,
          );
        }
        await shelveOnHardcover(userId, account.token, bookId, hardcoverBookId, value, finishedAt);
        return c.json({ bookId, rating: value });
      }

      if (entry.userBookId === null) {
        // Not on their shelves. Adding a book is the reader's call, made in
        // the client's confirmation — never a side effect of a star click.
        if (!addToShelf) {
          return c.json(
            { error: "This book isn't on their Hardcover shelves.", code: "not-on-shelf" },
            409,
          );
        }
        // Shelve as Read — what rating a book means on hardcover.app — then rate.
        await shelveOnHardcover(
          userId,
          account.token,
          bookId,
          entry.hardcoverBookId,
          value,
          finishedAt,
        );
      } else if (markRead) {
        // The mark-as-read ask, granted: a shelved-but-unfinished book flips
        // to Read with its rating and its finished-when in one write
        // (docs/features/rating-a-book.md).
        await markUserBookRead(account.token, entry.userBookId, {
          rating: value ?? undefined,
          finishedAt,
        });
        if (!finishedAt) await clearDefaultReadDates(account.token, entry.userBookId);
        getHardcoverBooks().setRating(userId, entry.hardcoverBookId, value, 3);
      } else {
        await updateUserBookRating(account.token, entry.userBookId, value);
        getHardcoverBooks().setRating(userId, entry.hardcoverBookId, value);
      }
    } catch (err) {
      // Their refusal, worth relaying (an expired token, a rate limit) — the
      // stars roll back client-side like any failed write.
      if (err instanceof HardcoverError) return c.json({ error: err.message }, 502);
      throw err;
    }

    return c.json({ bookId, rating: value });
  });

  // The corner check (docs/features/marking-a-book-read.md). This map is the
  // *local* store; in Hardcover mode the client reads status 3 off
  // /api/ratings/hardcover instead, the same map the stars use.
  app.get("/api/read-states", (c) => c.json(getReadStates().forUser(requireUser(c))));

  app.put(
    "/api/read-states/:bookId",
    zValidator("json", ReadStateUpdateSchema, invalid),
    async (c) => {
      const userId = requireUser(c);
      const bookId = Number(c.req.param("bookId"));
      if (!Number.isInteger(bookId) || bookId <= 0) {
        return c.json({ error: `"${c.req.param("bookId")}" is not a book id.` }, 400);
      }
      if (!getBooks().get(bookId)) {
        return c.json({ error: `No book with id ${bookId}.` }, 404);
      }

      const { read, finishedAt, rating, removeRating, source, addToShelf, hardcoverBookId } =
        c.req.valid("json");

      if (source === "local") {
        // The optional rating rides along to the *same* store, so a modal
        // shortcut can never scatter one reader's ratings across two.
        if (read) {
          getReadStates().set(userId, bookId, finishedAt ?? null);
          if (rating !== undefined) getRatings().set(userId, bookId, rating);
        } else {
          getReadStates().clear(userId, bookId);
          if (removeRating) getRatings().clear(userId, bookId);
        }
        return c.json({ bookId, read, finishedAt: read ? (finishedAt ?? null) : null });
      }

      // On Hardcover, read means status Read on their shelves.
      const account = getUsers().hardcoverAccount(userId);
      if (!account) {
        return c.json({ error: "This reader has no Hardcover account linked." }, 400);
      }

      const entry = getHardcoverBooks().shelfEntryForWork(userId, bookId);
      try {
        if (read) {
          if (!entry) {
            // Calibre-only: the finder's pick is the confirmation, exactly as
            // for a rating.
            if (!hardcoverBookId || !addToShelf) {
              return c.json(
                {
                  error:
                    "This book has no Hardcover edition, so there's nowhere there to mark it read.",
                  code: "no-hardcover-edition",
                },
                409,
              );
            }
            await shelveOnHardcover(
              userId,
              account.token,
              bookId,
              hardcoverBookId,
              rating ?? null,
              finishedAt,
            );
          } else if (entry.userBookId === null) {
            if (!addToShelf) {
              return c.json(
                { error: "This book isn't on their Hardcover shelves.", code: "not-on-shelf" },
                409,
              );
            }
            await shelveOnHardcover(
              userId,
              account.token,
              bookId,
              entry.hardcoverBookId,
              rating ?? null,
              finishedAt,
            );
          } else {
            // Status, rating (when given) and finished-when land in one write.
            await markUserBookRead(account.token, entry.userBookId, { rating, finishedAt });
            if (!finishedAt) await clearDefaultReadDates(account.token, entry.userBookId);
            if (rating !== undefined) {
              getHardcoverBooks().setRating(userId, entry.hardcoverBookId, rating, 3);
            } else {
              getHardcoverBooks().setStatus(userId, entry.hardcoverBookId, 3);
            }
          }
        } else if (entry?.userBookId != null) {
          // Unmarking. Their model needs *some* status, so the book goes back
          // to Want to Read — the modal said as much — optionally taking the
          // rating with it. The read entries stay; that history isn't ours to
          // erase. A book not on their shelves is already as unread as it gets.
          await updateUserBookStatus(account.token, entry.userBookId, 1);
          if (removeRating) {
            await updateUserBookRating(account.token, entry.userBookId, null);
            getHardcoverBooks().setRating(userId, entry.hardcoverBookId, null, 1);
          } else {
            getHardcoverBooks().setStatus(userId, entry.hardcoverBookId, 1);
          }
        }
      } catch (err) {
        // Their refusal, worth relaying — the corner rolls back client-side.
        if (err instanceof HardcoverError) return c.json({ error: err.message }, 502);
        throw err;
      }

      return c.json({ bookId, read, finishedAt: read ? (finishedAt ?? null) : null });
    },
  );

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

  // One scheduler per process, started here rather than by each delivery target,
  // so desktop / server / `bun dev` all behave the same (ADR 0002). Syncs once
  // immediately: "start the app by syncing the data".
  if (options.sync !== false) {
    // Before either syncer, so a library that predates works — or one that has
    // simply not changed since the matcher arrived — is grouped on this launch
    // rather than waiting for a book to be edited. Idempotent, so every later
    // start is a no-op (docs/features/book-matching.md).
    getWorks().matchAll();
    getSync().start();
    getHardcoverSync().start();
  }

  return Object.assign(app, {
    /** The sync schedulers, so a host can stop them on shutdown. */
    sync: getSync(),
    hardcoverSync: getHardcoverSync(),
  });
}

export type GrimoireApi = ReturnType<typeof createApi>;
