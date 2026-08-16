import type { Database } from "bun:sqlite";
import type { CalibreBookRow } from "./calibre-books.ts";
import { resolveDatabase } from "./db.ts";
import type { HardcoverBookRow, MirroredSeries } from "./hardcover-books.ts";
import { matchKey } from "./matching.ts";
import type { Book, SeriesRef } from "./schemas.ts";
import { hardcoverContentPrefs } from "./schemas.ts";
import { type AttachmentInput, orderSeries, SeriesStore } from "./series.ts";
import { SettingsStore } from "./settings.ts";
import { BOOK_SOURCE, SERIES_SOURCE, type SeriesSource } from "./types.ts";

interface BookRow {
  id: number;
  source: string;
  calibre_uuid: string | null;
  calibre_id: number | null;
  title: string;
  title_sort: string | null;
  authors: string;
  author_sort: string | null;
  series: string | null;
  series_index: number | null;
  tags: string;
  formats: string;
  publisher: string | null;
  languages: string;
  identifiers: string;
  description: string | null;
  pages: number | null;
  published: string | null;
  added: string;
  cover_state: string;
  cover_synced_at: string | null;
  hardcover_id: number | null;
  cover_url: string | null;
  work_id: number;
  match_key: string | null;
  /**
   * From the work, not the book: which member a reader chose to show the cover
   * of, or null when nobody has. Joined onto every member row, so `toBook` can
   * resolve it without a second query.
   */
  work_cover_book_id: number | null;
}

/**
 * Every member row of a work, with its work's cover choice alongside. One join
 * rather than a query per work: the shelf reads the whole library in one pass.
 */
const MEMBER_ROWS = `SELECT b.*, w.cover_book_id AS work_cover_book_id
                       FROM books b
                       JOIN works w ON w.id = b.work_id`;

/**
 * Which source wins a field when a work has members from several (ADR 0013).
 * Calibre first because it knows the things it can only know — the file, its
 * formats, the title you gave it — and the others fill what it leaves empty.
 */
const SOURCE_PRECEDENCE = [BOOK_SOURCE.calibre, BOOK_SOURCE.grimoire, BOOK_SOURCE.hardcover];

const precedence = (source: string): number => {
  const index = SOURCE_PRECEDENCE.indexOf(source as (typeof SOURCE_PRECEDENCE)[number]);
  return index === -1 ? SOURCE_PRECEDENCE.length : index;
};

/** What a reconcile did, for the sync log and the progress readout. */
export interface ReconcileResult {
  inserted: number;
  updated: number;
  /** Books that left the connected library and had their `calibre_id` cleared. */
  unlinked: number;
}

/** A book needing its covers fetched, and the id to fetch them from Calibre with. */
export interface CoverTarget {
  id: number;
  calibreId: number;
  lastModified: string;
}

function parseArray(json: string): string[] {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function parseSeries(json: string | null): MirroredSeries[] {
  if (!json) return [];
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? (value as MirroredSeries[]) : [];
  } catch {
    return [];
  }
}

/**
 * Whether a source's stored attachments already say what it now says — series
 * and position both, since a book moving from #3 to #4 is a change worth
 * writing and nothing else about the row is.
 */
function sameAttachments(current: readonly SeriesRef[], next: readonly AttachmentInput[]): boolean {
  if (current.length !== next.length) return false;
  const key = (id: number, position: number | null | undefined) => `${id}:${position ?? ""}`;
  const have = new Set(current.map((ref) => key(ref.id, ref.position)));
  return next.every((attachment) => have.has(key(attachment.seriesId, attachment.position)));
}

function parseRecord(json: string): Record<string, string> {
  try {
    const value = JSON.parse(json);
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

/**
 * One work, as the shelf renders it: the members' fields merged by source
 * precedence, their sources unioned — which is what lights up more than one
 * mark on a card (docs/features/book-list.md).
 *
 * **`id` is the work's id, not any member's** (ADR 0013). It is what a rating
 * keys on and what a cover URL names; the member row ids stay server-side.
 */
function toBook(members: BookRow[], series: readonly SeriesRef[], preferHardcover: boolean): Book {
  const rows = [...members].sort((a, b) => precedence(a.source) - precedence(b.source));
  const first = rows[0];
  if (!first) throw new Error("A work with no books");

  /** The first member that has this field, in precedence order. */
  const pick = <T>(read: (row: BookRow) => T | null | undefined): T | null => {
    for (const row of rows) {
      const value = read(row);
      if (value !== null && value !== undefined && value !== "") return value;
    }
    return null;
  };
  const pickList = (read: (row: BookRow) => string): string[] => {
    for (const row of rows) {
      const list = parseArray(read(row));
      if (list.length > 0) return list;
    }
    return [];
  };

  // A cached file beats a remote URL, whichever member holds it.
  const cached = rows.some((row) => row.cover_state === "cached");
  const missing = rows.some((row) => row.cover_state === "missing");

  // Every member that actually has a file, in source-precedence order — so the
  // one a reader is offered first is Calibre's, the edition they own.
  const covers = rows
    .filter((row) => row.cover_state === "cached")
    .map((row) => ({ bookId: row.id, source: row.source }));

  // A choice only counts while the member it names still has a cover; a work
  // whose chosen member lost one falls back to the rule rather than to nothing.
  const chosen = covers.find((cover) => cover.bookId === first.work_cover_book_id);

  // Attachments first, the member rows' own string as the fallback (ADR 0019):
  // a library that has not been reconciled since these tables arrived has no
  // attachments yet, and must not lose its series line waiting for a sweep.
  const seriesList = orderSeries(series, preferHardcover);
  const primary = seriesList[0] ?? null;

  return {
    id: first.work_id,
    sources: [...new Set(rows.map((row) => row.source))],
    // The rows behind the work, not the sources: two Calibre rows joined by
    // hand are two entries and one source (docs/features/resolving-duplicates.md).
    entries: rows.length,
    // From whichever member is the Calibre one; null when no member is in the
    // library, which is still the exact test for "is there a file to download".
    calibreId: pick((row) => row.calibre_id),
    title: first.title,
    authors: pickList((row) => row.authors),
    series: primary?.name ?? pick((row) => row.series),
    seriesIndex: primary ? primary.position : pick((row) => row.series_index),
    seriesList,
    tags: pickList((row) => row.tags),
    formats: pickList((row) => row.formats),
    publisher: pick((row) => row.publisher),
    languages: pickList((row) => row.languages),
    identifiers:
      rows.map((row) => parseRecord(row.identifiers)).find((ids) => Object.keys(ids).length > 0) ??
      {},
    description: pick((row) => row.description),
    pages: pick((row) => row.pages),
    published: pick((row) => row.published),
    // The earliest date any source took the book in — a book does not become
    // newer by turning up somewhere else.
    added: rows.map((row) => row.added).sort()[0] ?? first.added,
    coverState: cached ? "cached" : missing ? "missing" : "none",
    // Only offered while a cover is still waiting to be downloaded, so the
    // shelf has something to draw during a first sync. A cover already proven
    // unfetchable is not worth sending the browser after.
    coverUrl: cached || missing ? null : pick((row) => row.cover_url),
    covers,
    coverBookId: chosen?.bookId ?? covers[0]?.bookId ?? null,
    // One version for the whole work rather than one per member: it exists to
    // change a URL after a re-fetch (docs/features/book-actions.md), and a
    // re-fetch does every member at once.
    coverVersion:
      rows
        .filter((row) => row.cover_state === "cached" && row.cover_synced_at)
        .map((row) => row.cover_synced_at as string)
        .sort()
        .at(-1) ?? null,
  };
}

/**
 * Fold rows into works, ordered the way the shelf wants them: by the sort title
 * where a source gave us one — Calibre files "The Blade Itself" under B — and by
 * the title itself otherwise. Sorting happens here rather than in SQL because a
 * work's title is decided by merging its members, which SQL cannot do before it
 * orders.
 */
function toBooks(
  rows: BookRow[],
  series: Map<number, SeriesRef[]>,
  preferHardcover: boolean,
): Book[] {
  const works = new Map<number, BookRow[]>();
  for (const row of rows) {
    const members = works.get(row.work_id);
    if (members) members.push(row);
    else works.set(row.work_id, [row]);
  }

  return [...works.values()]
    .map((members) => {
      const sorted = [...members].sort((a, b) => precedence(a.source) - precedence(b.source));
      const lead = sorted[0];
      return {
        book: toBook(members, series.get(lead?.work_id ?? -1) ?? [], preferHardcover),
        sortKey: (lead?.title_sort || lead?.title) ?? "",
      };
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map((entry) => entry.book);
}

/**
 * Grimoire's own book records — the table every library screen reads (ADR 0011).
 *
 * The reconcile below is the heart of the sync. Two rules it will not bend:
 * books are matched by Calibre's **uuid** and never by its book id, and a sync
 * **never deletes a book**. See docs/features/calibre-sync.md.
 */
export class BooksStore {
  private db: Database;
  private series: SeriesStore;
  private settings: SettingsStore;

  constructor(source?: Database | string) {
    this.db = resolveDatabase(source);
    this.series = new SeriesStore(this.db);
    this.settings = new SettingsStore(this.db);
  }

  /**
   * Whether a Hardcover series outranks Calibre's, read per call rather than
   * held: the switch applies the moment it is flipped (ADR 0019), and a primary
   * decided at read time is what lets it.
   */
  private preferHardcoverSeries(): boolean {
    return hardcoverContentPrefs(this.settings.all()).series;
  }

  /** The shelf: one entry per work, not per row (ADR 0013). */
  list(): Book[] {
    return toBooks(
      this.db.query(`${MEMBER_ROWS} ORDER BY b.work_id`).all() as BookRow[],
      this.series.all(),
      this.preferHardcoverSeries(),
    );
  }

  /** By *work* id — the id every payload speaks. */
  get(workId: number): Book | null {
    const rows = this.db
      .query(`${MEMBER_ROWS} WHERE b.work_id = $workId`)
      .all({ $workId: workId }) as BookRow[];
    if (rows.length === 0) return null;
    return toBook(rows, this.series.forWork(workId), this.preferHardcoverSeries());
  }

  /**
   * Which member's file to serve as this work's cover. Cover files are named by
   * the member's own id, so a work has to be resolved to whichever member
   * actually has one — the reader's choice if they made one, and otherwise
   * Calibre's, the edition they own.
   *
   * Read off the assembled work rather than from its own query, so the order
   * the panel offers covers in and the one the shelf draws can never disagree.
   */
  coverBookId(workId: number): number | null {
    return this.get(workId)?.coverBookId ?? null;
  }

  /**
   * That work's cover held by *this* member, for drawing the ones a reader
   * hasn't chosen. Null unless the book really is in the work and really has a
   * file — a cover URL is not a way to enumerate the library.
   */
  memberCoverBookId(workId: number, bookId: number): number | null {
    const covers = this.get(workId)?.covers ?? [];
    return covers.some((cover) => cover.bookId === bookId) ? bookId : null;
  }

  /**
   * Show this member's cover for the work from now on
   * (docs/features/book-details-panel.md). Returns the work as it now is, or
   * null if the book is not a member of it or has no cover to show — a choice
   * that could not be honoured is not worth storing.
   */
  chooseCover(workId: number, bookId: number): Book | null {
    if (this.memberCoverBookId(workId, bookId) === null) return null;
    this.db
      .query("UPDATE works SET cover_book_id = $bookId WHERE id = $workId")
      .run({ $workId: workId, $bookId: bookId });
    return this.get(workId);
  }

  /** Books on the shelf — works, since that is what a reader counts. */
  count(): number {
    const row = this.db.query("SELECT COUNT(DISTINCT work_id) AS n FROM books").get() as {
      n: number;
    };
    return row.n;
  }

  /** How many are still in the connected Calibre library. */
  inLibraryCount(): number {
    const row = this.db
      .query("SELECT COUNT(DISTINCT work_id) AS n FROM books WHERE calibre_id IS NOT NULL")
      .get() as { n: number };
    return row.n;
  }

  /**
   * Fold the whole mirror into `books`, matching on `calibre_uuid`.
   *
   * Runs in one transaction: a reconcile that half-applied would leave books
   * pointing at ids from two different libraries, which is the exact state this
   * design exists to prevent.
   */
  reconcileFromCalibre(mirror: CalibreBookRow[], now: string): ReconcileResult {
    const result: ReconcileResult = { inserted: 0, updated: 0, unlinked: 0 };

    const existing = this.db
      .query("SELECT id, calibre_uuid FROM books WHERE calibre_uuid IS NOT NULL")
      .all() as {
      id: number;
      calibre_uuid: string;
    }[];
    const byUuid = new Map(existing.map((r) => [r.calibre_uuid, r.id]));

    const insert = this.db.query(
      `INSERT INTO books (
         source, calibre_uuid, calibre_id, title, title_sort, authors, author_sort,
         series, series_index, tags, formats, publisher, languages, identifiers,
         description, pages, published, added, match_key, work_id, created_at, updated_at
       ) VALUES (
         $source, $calibreUuid, $calibreId, $title, $titleSort, $authors, $authorSort,
         $series, $seriesIndex, $tags, $formats, $publisher, $languages, $identifiers,
         $description, $pages, $published, $added, $matchKey, $workId, $now, $now
       )`,
    );

    // calibre_uuid is absent here on purpose: it is identity, set once on
    // insert and never rewritten. Everything else, including calibre_id, is
    // Calibre's to change — and match_key with them, since it is derived from a
    // title Calibre can edit. work_id is *not* rewritten: which work a book
    // belongs to is the matcher's business, never sync's.
    const update = this.db.query(
      `UPDATE books SET
         calibre_id = $calibreId, title = $title, title_sort = $titleSort,
         authors = $authors, author_sort = $authorSort, series = $series,
         series_index = $seriesIndex, tags = $tags, formats = $formats,
         publisher = $publisher, languages = $languages, identifiers = $identifiers,
         description = $description, pages = $pages, published = $published,
         match_key = $matchKey, updated_at = $now
       WHERE id = $id`,
    );

    const run = this.db.transaction((rows: CalibreBookRow[]) => {
      // Clear the pointer on every book first, then let the loop below re-set it
      // for those still present. Doing it in this order means an id that moved
      // to a different book within one pass can never be held by two rows at
      // once, even briefly.
      const seenUuids = new Set(rows.map((r) => r.uuid));
      const linked = this.db
        .query("SELECT id, calibre_uuid FROM books WHERE calibre_id IS NOT NULL")
        .all() as { id: number; calibre_uuid: string | null }[];
      for (const book of linked) {
        if (!book.calibre_uuid || !seenUuids.has(book.calibre_uuid)) result.unlinked++;
      }
      this.db.run("UPDATE books SET calibre_id = NULL WHERE calibre_id IS NOT NULL");

      for (const row of rows) {
        const shared = {
          $calibreId: row.calibre_id,
          $title: row.title,
          $titleSort: row.title_sort,
          $authors: row.authors,
          $authorSort: row.author_sort,
          $series: row.series,
          $seriesIndex: row.series_index,
          $tags: row.tags,
          $formats: row.formats,
          $publisher: row.publisher,
          $languages: row.languages,
          $identifiers: row.identifiers,
          $description: row.comments,
          $pages: row.pages,
          $published: row.pubdate,
          $matchKey: matchKey(row.title),
          $now: now,
        };

        const id = byUuid.get(row.uuid);
        if (id === undefined) {
          insert.run({
            ...shared,
            $source: BOOK_SOURCE.calibre,
            $calibreUuid: row.uuid,
            $added: row.timestamp ?? now,
            $workId: this.createWork(now),
          });
          result.inserted++;
        } else {
          update.run({ ...shared, $id: id });
          result.updated++;
        }
      }
    });

    run(mirror);
    return result;
  }

  /**
   * Fold the Hardcover mirror into `books`, matched on **Hardcover's own book
   * id and nothing else** — not title, not ISBN. A book that is also in Calibre
   * therefore gets a second row, in its own work; deciding that the two rows
   * are one book belongs to the matcher, which runs after this
   * (docs/features/book-matching.md).
   *
   * Same two rules as the Calibre reconcile: one transaction, and no deletes.
   */
  reconcileFromHardcover(mirror: HardcoverBookRow[], now: string): ReconcileResult {
    const result: ReconcileResult = { inserted: 0, updated: 0, unlinked: 0 };

    const existing = this.db
      .query("SELECT id, hardcover_id FROM books WHERE hardcover_id IS NOT NULL")
      .all() as { id: number; hardcover_id: number }[];
    const byHardcoverId = new Map(existing.map((row) => [row.hardcover_id, row.id]));

    const insert = this.db.query(
      `INSERT INTO books (
         source, hardcover_id, title, title_sort, authors, tags, description,
         pages, published, added, cover_url, match_key, work_id, created_at, updated_at
       ) VALUES (
         $source, $hardcoverId, $title, $titleSort, $authors, $tags, $description,
         $pages, $published, $added, $coverUrl, $matchKey, $workId, $now, $now
       )`,
    );

    // hardcover_id is absent here for the same reason calibre_uuid is: it is
    // identity, set on insert and never rewritten. So is work_id — grouping
    // belongs to the matcher, not to a sync.
    const update = this.db.query(
      `UPDATE books SET
         title = $title, title_sort = $titleSort, authors = $authors, tags = $tags,
         description = $description, pages = $pages, published = $published,
         cover_url = $coverUrl, match_key = $matchKey, updated_at = $now,
         -- A new cover URL invalidates the file cached from the old one. Every
         -- SET reads the row as it was, so this compares old against new.
         cover_state = CASE WHEN cover_url IS NOT $coverUrl THEN 'none' ELSE cover_state END
       WHERE id = $id`,
    );

    this.db.transaction((rows: HardcoverBookRow[]) => {
      for (const row of rows) {
        const shared = {
          $title: row.title,
          // Hardcover has no sort title, so the shelf's ordering key is the
          // title itself rather than nothing — otherwise every Hardcover book
          // sorts after every Calibre one.
          $titleSort: row.title,
          $authors: row.authors,
          $tags: row.tags,
          $description: row.description,
          $pages: row.pages,
          $published: row.release_date,
          $coverUrl: row.cover_url,
          $matchKey: matchKey(row.title),
          $now: now,
        };

        const id = byHardcoverId.get(row.hardcover_id);
        if (id === undefined) {
          insert.run({
            ...shared,
            $source: BOOK_SOURCE.hardcover,
            $hardcoverId: row.hardcover_id,
            $added: now,
            $workId: this.createWork(now),
          });
          result.inserted++;
        } else {
          update.run({ ...shared, $id: id });
          result.updated++;
        }
      }
    })(mirror);

    return result;
  }

  /**
   * Turn what the sources say about series into `series` and `work_series` rows
   * (ADR 0019). Run after either reconcile, over the whole library rather than
   * over one sweep's rows: attachments are per *work*, a work's members can come
   * from either source, and a library that predates these tables has to be
   * caught up as well.
   *
   * Both sources are recomputed from what they currently say — a series removed
   * in Calibre loses its attachment here. A `manual` attachment is nobody's to
   * remove but the person who made it, and `replaceForWork` leaves it alone.
   *
   * Idempotent, and quiet when nothing changed: a work whose attachments already
   * match is not rewritten, so the common case of a sync that changed no series
   * writes nothing at all.
   */
  reconcileSeries(): { works: number; attachments: number } {
    const rows = this.db
      .query(
        `SELECT b.work_id, b.source, b.series, b.series_index, hb.series AS hardcover_series
           FROM books b
           LEFT JOIN hardcover_books hb ON hb.hardcover_id = b.hardcover_id`,
      )
      .all() as {
      work_id: number;
      source: string;
      series: string | null;
      series_index: number | null;
      hardcover_series: string | null;
    }[];

    // What each source says a work is in, gathered across the work's members.
    const wanted = new Map<number, Map<SeriesSource, Map<number, AttachmentInput>>>();
    const want = (workId: number, source: SeriesSource, attachment: AttachmentInput) => {
      const bySource = wanted.get(workId) ?? new Map<SeriesSource, Map<number, AttachmentInput>>();
      wanted.set(workId, bySource);
      const bySeries = bySource.get(source) ?? new Map<number, AttachmentInput>();
      bySource.set(source, bySeries);
      const existing = bySeries.get(attachment.seriesId);
      // Two members naming one series: keep a position over none, and featured
      // over not — the same "an answer beats no answer" the resolver applies.
      if (!existing) bySeries.set(attachment.seriesId, attachment);
      else {
        existing.position ??= attachment.position;
        existing.featured ||= attachment.featured;
      }
    };

    let attachments = 0;
    const write = this.db.transaction(() => {
      for (const row of rows) {
        if (row.source === BOOK_SOURCE.calibre && row.series) {
          // Calibre's is a string somebody typed, so this is where three
          // spellings of one series become one row.
          want(row.work_id, SERIES_SOURCE.calibre, {
            workId: row.work_id,
            seriesId: this.series.upsert({ name: row.series }),
            position: row.series_index,
          });
        }

        for (const entry of parseSeries(row.hardcover_series)) {
          // An entry the hydrate never named cannot be identified — their id is
          // not enough to create a row somebody has to read. Skipped, and picked
          // up by the next sweep that names it.
          if (!entry.name) continue;
          want(row.work_id, SERIES_SOURCE.hardcover, {
            workId: row.work_id,
            seriesId: this.series.upsert({
              name: entry.name,
              hardcoverId: entry.seriesId,
              slug: entry.slug,
              booksCount: entry.booksCount,
            }),
            position: entry.position,
            featured: entry.featured,
          });
        }
      }

      const current = this.series.all();
      for (const [workId, bySource] of wanted) {
        for (const source of [SERIES_SOURCE.calibre, SERIES_SOURCE.hardcover] as const) {
          const next = [...(bySource.get(source)?.values() ?? [])];
          const now = (current.get(workId) ?? []).filter((ref) => ref.source === source);
          if (sameAttachments(now, next)) continue;
          this.series.replaceForWork(workId, source, next);
          attachments += next.length;
        }
      }

      // A work nothing claims any more — its Calibre series cleared, its
      // Hardcover side gone — is not in `wanted` at all, so its stale rows are
      // swept here rather than being left to outlive the source that made them.
      for (const [workId, refs] of current) {
        if (wanted.has(workId)) continue;
        for (const source of [SERIES_SOURCE.calibre, SERIES_SOURCE.hardcover] as const) {
          if (refs.some((ref) => ref.source === source))
            this.series.replaceForWork(workId, source, []);
        }
      }
    });

    write();
    return { works: wanted.size, attachments };
  }

  /**
   * Books whose cached covers are older than the book itself, newest first so a
   * first sync fills in what the user is most likely looking at.
   *
   * Comparing against `last_modified` is coarse — editing a title refetches
   * three images — but a stale cover is worse than a wasted request, and
   * Calibre exposes no cover-specific mtime.
   *
   * `retryMissing` also re-queues the books a previous run failed on. A failure
   * stamps `cover_synced_at` with the book's own `last_modified`, so nothing
   * above would ever pick it up again — one unreachable minute would cost those
   * books their covers until Calibre next edited them. A full sync is the
   * remedy, and only a full sync: retrying every failure every tick is how a
   * library with a genuinely coverless book hammers the content server forever.
   */
  coversToFetch(retryMissing = false): CoverTarget[] {
    const rows = this.db
      .query(
        `SELECT b.id AS id, b.calibre_id AS calibreId, c.last_modified AS lastModified
           FROM books b
           JOIN calibre_books c ON c.calibre_id = b.calibre_id
          WHERE b.calibre_id IS NOT NULL
            AND c.has_cover = 1
            AND (b.cover_synced_at IS NULL
                 OR b.cover_synced_at < c.last_modified
                 OR ($retryMissing = 1 AND b.cover_state = 'missing'))
          ORDER BY c.last_modified DESC`,
      )
      .all({ $retryMissing: retryMissing ? 1 : 0 }) as CoverTarget[];
    return rows;
  }

  /**
   * Books whose cover is a URL we haven't cached yet — Hardcover's, today
   * (docs/features/hardcover-sync.md).
   *
   * Normally `cover_state = 'none'` and not merely "not cached", so a book
   * whose image failed to download is marked `missing` and left alone rather
   * than retried every sync. Reconcile resets it to `none` when the URL
   * changes, which is one thing that should make us try again.
   *
   * `retryMissing` is the other: a full sync tries the failures again, because
   * "it looks wrong, re-sync" has to be a real remedy. Without it a single
   * minute without a network — someone else's CDN, so this is not rare — marks
   * a whole shelf `missing` permanently, and nothing short of editing the book
   * on Hardcover ever asks again.
   */
  remoteCoversToFetch(retryMissing = false): { id: number; url: string }[] {
    return this.db
      .query(
        `SELECT id, cover_url AS url FROM books
          WHERE cover_url IS NOT NULL
            AND (cover_state = 'none' OR ($retryMissing = 1 AND cover_state = 'missing'))
          ORDER BY id`,
      )
      .all({ $retryMissing: retryMissing ? 1 : 0 }) as { id: number; url: string }[];
  }

  /**
   * Books with a remote cover the database calls cached, for checking that
   * claim against the filesystem — the `covers/` tree is disposable (ADR 0007),
   * and these are the ones the Calibre pass can't rebuild because they have no
   * Calibre id to re-fetch from.
   */
  cachedRemoteCoverTargets(): { id: number; url: string }[] {
    return this.db
      .query(
        `SELECT id, cover_url AS url FROM books
          WHERE cover_url IS NOT NULL AND cover_state = 'cached'
          ORDER BY id`,
      )
      .all() as { id: number; url: string }[];
  }

  /**
   * Every member of one work with somewhere to fetch a cover from — Calibre's
   * id, a stored URL, or both (docs/features/book-actions.md). Unlike the two
   * queues above this asks nothing about what is already cached: it answers a
   * reader who has looked at the cover and said to fetch it again.
   */
  coverSourcesForWork(
    workId: number,
  ): { id: number; calibreId: number | null; url: string | null }[] {
    return this.db
      .query(
        `SELECT id, calibre_id AS calibreId, cover_url AS url FROM books
          WHERE work_id = $workId AND (calibre_id IS NOT NULL OR cover_url IS NOT NULL)
          ORDER BY id`,
      )
      .all({ $workId: workId }) as { id: number; calibreId: number | null; url: string | null }[];
  }

  /**
   * Books the database believes have cached covers, for checking that claim
   * against the filesystem. Only those still in Calibre, since a book that has
   * left cannot have its cover fetched again anyway.
   */
  cachedCoverTargets(): CoverTarget[] {
    return this.db
      .query(
        `SELECT b.id AS id, b.calibre_id AS calibreId, c.last_modified AS lastModified
           FROM books b
           JOIN calibre_books c ON c.calibre_id = b.calibre_id
          WHERE b.cover_state = 'cached' AND b.calibre_id IS NOT NULL`,
      )
      .all() as CoverTarget[];
  }

  /**
   * A work of its own for a book being inserted. Every book starts alone (ADR
   * 0013); the matcher is the only thing that ever moves one.
   */
  private createWork(now: string): number {
    const work = this.db
      .query("INSERT INTO works (created_at) VALUES ($now) RETURNING id")
      .get({ $now: now }) as { id: number };
    return work.id;
  }

  /**
   * The work holding a Hardcover catalogue book, if the reconcile has seen it —
   * what the finder's rating write links into the Calibre book's work
   * (docs/features/rating-a-book.md).
   */
  workForHardcoverId(hardcoverId: number): number | null {
    const row = this.db
      .query("SELECT work_id FROM books WHERE hardcover_id = $hardcoverId")
      .get({ $hardcoverId: hardcoverId }) as { work_id: number } | null;
    return row?.work_id ?? null;
  }

  markCover(id: number, state: "cached" | "missing", syncedAt: string | null): void {
    this.db
      .query("UPDATE books SET cover_state = $state, cover_synced_at = $syncedAt WHERE id = $id")
      .run({ $id: id, $state: state, $syncedAt: syncedAt });
  }

  close(): void {
    this.db.close();
  }
}
