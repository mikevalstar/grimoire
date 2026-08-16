import type { Database } from "bun:sqlite";
import { resolveDatabase } from "./db.ts";
import { seriesKey } from "./matching.ts";
import type { SeriesRef } from "./schemas.ts";
import { SERIES_SOURCE, type SeriesSource } from "./types.ts";

interface SeriesRow {
  id: number;
  hardcover_id: number | null;
  name: string;
  match_key: string;
  slug: string | null;
  books_count: number | null;
}

interface AttachmentRow extends SeriesRow {
  work_id: number;
  position: number | null;
  source: string;
  featured: number;
  is_primary: number;
}

/** A series itself, with nothing said about which works are in it. */
export interface SeriesRecord {
  id: number;
  hardcoverId: number | null;
  name: string;
  slug: string | null;
  booksCount: number | null;
}

/** A series as somebody wants it written down — from Hardcover, or by hand. */
export interface SeriesInput {
  name: string;
  hardcoverId?: number | null;
  slug?: string | null;
  booksCount?: number | null;
}

/** One work's place in one series, as a caller states it. */
export interface AttachmentInput {
  workId: number;
  seriesId: number;
  position?: number | null;
  featured?: boolean;
}

/**
 * Series as records, and which works are in them (ADR 0019).
 *
 * Two rules carry most of this file. Identity is Hardcover's id where they
 * named the series and the folded name otherwise, so one series does not become
 * three because Calibre spells it three ways. And an attachment's `source` says
 * who may take it away: reconcile owns `calibre` and `hardcover` and rewrites
 * them every sweep, while `manual` is a person's decision and survives — the
 * same bargain a chosen cover strikes.
 *
 * See docs/features/setting-a-series-from-hardcover.md.
 */
export class SeriesStore {
  private db: Database;

  constructor(source?: Database | string) {
    this.db = resolveDatabase(source);
  }

  /**
   * The series row for this input, creating it if it is new.
   *
   * A Hardcover series meeting a row that was created from a name alone
   * **adopts** it — stamping its id onto the row the library already points at,
   * rather than adding a second Discworld nobody asked for. That is why the
   * name index only covers rows Hardcover has not named: two of their series
   * may legitimately share a name, and those stay two rows.
   */
  upsert(input: SeriesInput): number {
    const name = input.name.trim();
    const key = seriesKey(name);
    if (!key) throw new Error("A series with no name");

    const now = new Date().toISOString();
    const hardcoverId = input.hardcoverId ?? null;

    if (hardcoverId !== null) {
      const known = this.db
        .query("SELECT * FROM series WHERE hardcover_id = $hardcoverId")
        .get({ $hardcoverId: hardcoverId }) as SeriesRow | null;
      if (known) {
        this.db
          .query(
            "UPDATE series SET name = $name, match_key = $key, slug = COALESCE($slug, slug), " +
              // COALESCE, not assignment: a caller that knows the name and not
              // the slug — the apply, re-run from a dialog that only kept the
              // name — must not erase what a sync already learned.
              "books_count = COALESCE($booksCount, books_count), updated_at = $now WHERE id = $id",
          )
          .run({
            $name: name,
            $key: key,
            $slug: input.slug ?? null,
            $booksCount: input.booksCount ?? null,
            $now: now,
            $id: known.id,
          });
        return known.id;
      }

      const orphan = this.db
        .query("SELECT * FROM series WHERE hardcover_id IS NULL AND match_key = $key")
        .get({ $key: key }) as SeriesRow | null;
      if (orphan) {
        this.db
          .query(
            "UPDATE series SET hardcover_id = $hardcoverId, name = $name, slug = COALESCE($slug, slug), " +
              // COALESCE, not assignment: a caller that knows the name and not
              // the slug — the apply, re-run from a dialog that only kept the
              // name — must not erase what a sync already learned.
              "books_count = COALESCE($booksCount, books_count), updated_at = $now WHERE id = $id",
          )
          .run({
            $hardcoverId: hardcoverId,
            $name: name,
            $slug: input.slug ?? null,
            $booksCount: input.booksCount ?? null,
            $now: now,
            $id: orphan.id,
          });
        return orphan.id;
      }
    } else {
      // Any row with this key is this series, **including one Hardcover has
      // named** — that is the whole point of the fold, and looking only at the
      // nameless rows would file Calibre's "The Discworld Series" under a second
      // Discworld beside the one their sync created.
      //
      // Oldest first, so a key shared by two of their series (which is allowed —
      // ids are what tell those apart) resolves the same way every time rather
      // than by row order.
      const known = this.db
        .query("SELECT * FROM series WHERE match_key = $key ORDER BY id LIMIT 1")
        .get({ $key: key }) as SeriesRow | null;
      if (known) return known.id;
    }

    const created = this.db
      .query(
        "INSERT INTO series (hardcover_id, name, match_key, slug, books_count, created_at, updated_at) " +
          "VALUES ($hardcoverId, $name, $key, $slug, $booksCount, $now, $now) RETURNING id",
      )
      .get({
        $hardcoverId: hardcoverId,
        $name: name,
        $key: key,
        $slug: input.slug ?? null,
        $booksCount: input.booksCount ?? null,
        $now: now,
      }) as { id: number };
    return created.id;
  }

  /** One series by its Hardcover id, for a roster the client asked for by that. */
  byHardcoverId(hardcoverId: number): SeriesRecord | null {
    const row = this.db
      .query("SELECT * FROM series WHERE hardcover_id = $hardcoverId")
      .get({ $hardcoverId: hardcoverId }) as SeriesRow | null;
    return row ? toRecord(row) : null;
  }

  /** One series by Grimoire's own id. */
  byId(id: number): SeriesRecord | null {
    const row = this.db
      .query("SELECT * FROM series WHERE id = $id")
      .get({ $id: id }) as SeriesRow | null;
    return row ? toRecord(row) : null;
  }

  /**
   * Attach works to a series, keeping any existing attachment's primary flag.
   * Re-running with the same input changes nothing, which is what makes the
   * apply dialog safe to press twice.
   */
  attach(source: SeriesSource, attachments: readonly AttachmentInput[]): void {
    if (attachments.length === 0) return;
    const now = new Date().toISOString();
    const stmt = this.db.query(
      "INSERT INTO work_series (work_id, series_id, position, source, featured, is_primary, created_at, updated_at) " +
        "VALUES ($workId, $seriesId, $position, $source, $featured, 0, $now, $now) " +
        "ON CONFLICT (work_id, series_id, source) DO UPDATE SET " +
        "position = excluded.position, featured = excluded.featured, " +
        "updated_at = excluded.updated_at",
    );
    this.db.transaction(() => {
      for (const attachment of attachments) {
        stmt.run({
          $workId: attachment.workId,
          $seriesId: attachment.seriesId,
          $position: attachment.position ?? null,
          $source: source,
          $featured: attachment.featured ? 1 : 0,
          $now: now,
        });
      }
    })();
  }

  /**
   * Rewrite everything one source says about a work — what reconcile does on
   * every sweep. Attachments that source no longer claims go; a `manual` one is
   * not this source's to remove, and stays.
   */
  replaceForWork(
    workId: number,
    source: Exclude<SeriesSource, "manual">,
    attachments: readonly Omit<AttachmentInput, "workId">[],
  ): void {
    const now = new Date().toISOString();
    this.db.transaction(() => {
      const keep = attachments.map((attachment) => attachment.seriesId);
      const placeholders = keep.map(() => "?").join(", ");
      this.db
        .query(
          `DELETE FROM work_series WHERE work_id = ? AND source = ?` +
            (keep.length > 0 ? ` AND series_id NOT IN (${placeholders})` : ""),
        )
        .run(workId, source, ...keep);

      for (const attachment of attachments) {
        this.db
          .query(
            "INSERT INTO work_series (work_id, series_id, position, source, featured, is_primary, created_at, updated_at) " +
              "VALUES ($workId, $seriesId, $position, $source, $featured, 0, $now, $now) " +
              // Only ever this source's own row — a manual attachment to the
              // same series is a different row and is left alone.
              "ON CONFLICT (work_id, series_id, source) DO UPDATE SET " +
              "position = excluded.position, featured = excluded.featured, " +
              "updated_at = excluded.updated_at",
          )
          .run({
            $workId: workId,
            $seriesId: attachment.seriesId,
            $position: attachment.position ?? null,
            $source: source,
            $featured: attachment.featured ? 1 : 0,
            $now: now,
          });
      }
    })();
  }

  /**
   * Which of a work's series heads its series line. Null clears the choice and
   * hands the work back to the rule — the same shape as unchoosing a cover.
   *
   * **The mark always lands on a `manual` attachment**, created here if the
   * series only arrived from a sync. Two reasons, both load-bearing:
   *
   * - A sweep rewrites its own rows (`replaceForWork`), so a flag on a
   *   `hardcover` row would survive until the next sync and no longer.
   * - One series can be attached by two sources at once, and marking "the rows
   *   for this series" would set the flag twice, which the partial unique index
   *   correctly refuses.
   *
   * Promoting is a person's decision, and this is where those live (ADR 0019),
   * so the row it needs is the row it makes.
   */
  setPrimary(workId: number, seriesId: number | null): void {
    const now = new Date().toISOString();
    this.db.transaction(() => {
      this.db
        .query("UPDATE work_series SET is_primary = 0 WHERE work_id = $workId")
        .run({ $workId: workId });

      if (seriesId === null) {
        // Handing the work back to the rule means removing what a *promotion*
        // left behind, not just its mark: a manual row outranks a synced one
        // even unmarked, so leaving it would keep the promoted series leading
        // and the clear would do nothing visible.
        //
        // Only the redundant ones go — a manual attachment to a series some
        // source already reports exists to carry the choice, and the book stays
        // in that series without it. One that is the *only* claim on a series
        // is why the book is in it at all (the dialog put it there), and
        // clearing which series leads is no way to remove a book from a series.
        this.db
          .query(
            `DELETE FROM work_series
              WHERE work_id = $workId AND source = 'manual'
                AND EXISTS (
                  SELECT 1 FROM work_series other
                   WHERE other.work_id = work_series.work_id
                     AND other.series_id = work_series.series_id
                     AND other.source <> 'manual'
                )`,
          )
          .run({ $workId: workId });
        return;
      }

      // Whatever the sync knew about the book's place in it — a promotion is
      // about which series leads, not about renumbering the book.
      const known = this.db
        .query(
          "SELECT position, featured FROM work_series " +
            "WHERE work_id = $workId AND series_id = $seriesId " +
            "ORDER BY CASE source WHEN 'manual' THEN 0 ELSE 1 END LIMIT 1",
        )
        .get({ $workId: workId, $seriesId: seriesId }) as {
        position: number | null;
        featured: number;
      } | null;

      this.db
        .query(
          "INSERT INTO work_series (work_id, series_id, position, source, featured, is_primary, created_at, updated_at) " +
            "VALUES ($workId, $seriesId, $position, 'manual', $featured, 1, $now, $now) " +
            "ON CONFLICT (work_id, series_id, source) DO UPDATE SET " +
            "is_primary = 1, updated_at = excluded.updated_at",
        )
        .run({
          $workId: workId,
          $seriesId: seriesId,
          $position: known?.position ?? null,
          $featured: known?.featured ?? 0,
          $now: now,
        });
    })();
  }

  /** Take a work out of a series, whatever attached it. */
  detach(workId: number, seriesId: number): void {
    this.db
      .query("DELETE FROM work_series WHERE work_id = $workId AND series_id = $seriesId")
      .run({ $workId: workId, $seriesId: seriesId });
  }

  /**
   * Every attachment in the library, by work — one query for a whole shelf,
   * since the list view resolves a primary for every book it draws.
   */
  all(): Map<number, SeriesRef[]> {
    return group(this.db.query(ATTACHMENTS).all() as AttachmentRow[]);
  }

  /** The attachments of one work, for a panel or a single-book response. */
  forWork(workId: number): SeriesRef[] {
    const rows = this.db
      .query(`${ATTACHMENTS} WHERE ws.work_id = $workId`)
      .all({ $workId: workId }) as AttachmentRow[];
    return group(rows).get(workId) ?? [];
  }

  /** Which works are already in a series — what the roster counts "on your shelf" with. */
  workIdsIn(seriesId: number): number[] {
    // DISTINCT because a work whose Calibre and Hardcover sides both name the
    // series has a row for each, and it is still one book on the shelf.
    const rows = this.db
      .query("SELECT DISTINCT work_id FROM work_series WHERE series_id = $seriesId")
      .all({ $seriesId: seriesId }) as { work_id: number }[];
    return rows.map((row) => row.work_id);
  }

  close(): void {
    this.db.close();
  }
}

const ATTACHMENTS = `SELECT ws.work_id, ws.position, ws.source, ws.featured, ws.is_primary,
                            s.id, s.hardcover_id, s.name, s.match_key, s.slug, s.books_count
                       FROM work_series ws
                       JOIN series s ON s.id = ws.series_id`;

function toRecord(row: SeriesRow): SeriesRecord {
  return {
    id: row.id,
    hardcoverId: row.hardcover_id,
    name: row.name,
    slug: row.slug,
    booksCount: row.books_count,
  };
}

function group(rows: readonly AttachmentRow[]): Map<number, SeriesRef[]> {
  const byWork = new Map<number, SeriesRef[]>();
  for (const row of rows) {
    const ref: SeriesRef = {
      id: row.id,
      name: row.name,
      slug: row.slug,
      hardcoverId: row.hardcover_id,
      booksCount: row.books_count,
      position: row.position,
      featured: row.featured === 1,
      source: asSource(row.source),
      primary: row.is_primary === 1,
    };
    const existing = byWork.get(row.work_id);
    if (existing) existing.push(ref);
    else byWork.set(row.work_id, [ref]);
  }
  return byWork;
}

function asSource(value: string): SeriesSource {
  return value === SERIES_SOURCE.calibre || value === SERIES_SOURCE.hardcover
    ? value
    : SERIES_SOURCE.manual;
}

/**
 * Which of a work's series the shelf means by "the series", and the list with
 * that one at its head (ADR 0019).
 *
 * The order is: a manual choice, then any manual attachment, then Hardcover's
 * — their featured series before the largest, so a Discworld book files under
 * Discworld rather than under Witches — then Calibre's.
 *
 * Derived here rather than stored, so flipping `preferHardcover` re-decides
 * every work's primary without a migration or a sweep. `primary` on the
 * returned refs is this answer, not the stored flag.
 */
export function orderSeries(refs: readonly SeriesRef[], preferHardcover: boolean): SeriesRef[] {
  if (refs.length === 0) return [];

  const rank = (ref: SeriesRef): number => {
    if (ref.source === SERIES_SOURCE.manual) return ref.primary ? 0 : 1;
    if (ref.source === SERIES_SOURCE.hardcover) return preferHardcover ? 2 : 4;
    return 3;
  };

  const ordered = [...refs].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    // Within Hardcover's, the series they call the book's home wins, then the
    // one that holds more books — the container before the sub-series.
    const byFeatured = Number(b.featured) - Number(a.featured);
    if (byFeatured !== 0) return byFeatured;
    const bySize = (b.booksCount ?? 0) - (a.booksCount ?? 0);
    if (bySize !== 0) return bySize;
    return a.name.localeCompare(b.name);
  });

  // Two sources naming the same series are two rows and one series (see the
  // `work_series` key). The best-ranked claim wins the entry and keeps its
  // provenance; a position the winner lacks is taken from the loser rather than
  // thrown away, since "Discworld, no idea which one" helps nobody.
  const bySeries = new Map<number, SeriesRef>();
  for (const ref of ordered) {
    const won = bySeries.get(ref.id);
    if (!won) bySeries.set(ref.id, { ...ref });
    else if (won.position === null && ref.position !== null) won.position = ref.position;
  }

  return [...bySeries.values()].map((ref, index) => ({ ...ref, primary: index === 0 }));
}
