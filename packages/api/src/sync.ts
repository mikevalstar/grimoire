import type { Database } from "bun:sqlite";
import {
  BooksStore,
  CalibreBooksStore,
  COVER_SIZE_NAMES,
  CoverStore,
  type CoverTarget,
  CsBooksSchema,
  CsSearchSchema,
  PREF_KEYS,
  type ReconcileResult,
  SettingsStore,
  type SyncProgress,
  type SyncStatus,
  syncIntervalMinutes,
  WorksStore,
} from "@grimoire/core";
import type { z } from "zod";

/** Books per `/ajax/books` request. Calibre takes an arbitrary id list; this keeps URLs sane. */
const PAGE_SIZE = 200;

/** Cover downloads in flight at once. Calibre scales these itself, so don't stampede it. */
const COVER_CONCURRENCY = 6;

/** How many of the mirror's lowest ids ride along on the first metadata request. */
const SENTINEL_COUNT = 20;

const REQUEST_TIMEOUT_MS = 30_000;

export interface SyncDeps {
  db: Database;
  /** Resolved per call, so changing the URL in settings takes effect on the next sync. */
  calibreServerUrl: () => string;
  dataDir: string;
}

/** Why a sync failed, in the shape the indicator's tooltip wants. */
export class SyncError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = "SyncError";
  }
}

export interface SyncOutcome {
  inserted: number;
  updated: number;
  unlinked: number;
  removedFromMirror: number;
  coversFetched: number;
  /** True when the id space turned out to belong to a different library. */
  remirrored: boolean;
}

/**
 * The Calibre sync (ADR 0011, docs/features/calibre-sync.md).
 *
 * Three phases, in order: mirror Calibre into `calibre_books`, reconcile that
 * into `books`, then cache covers — covers last, because cover files are named
 * by the Grimoire book id that reconcile assigns.
 *
 * One instance per Grimoire process, and one sync at a time within it.
 */
export class CalibreSync {
  private readonly settings: SettingsStore;
  private readonly mirror: CalibreBooksStore;
  private readonly books: BooksStore;
  private readonly works: WorksStore;
  private readonly covers: CoverStore;

  private running: Promise<SyncOutcome> | null = null;
  private progress: SyncProgress | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(private readonly deps: SyncDeps) {
    this.settings = new SettingsStore(deps.db);
    this.mirror = new CalibreBooksStore(deps.db);
    this.books = new BooksStore(deps.db);
    this.works = new WorksStore(deps.db);
    this.covers = new CoverStore(deps.dataDir);
  }

  // --- status ---------------------------------------------------------------

  status(): SyncStatus {
    const stored = this.settings.all();
    const lastStatus = stored[PREF_KEYS.syncLastStatus];
    return {
      running: this.running !== null,
      progress: this.progress,
      lastCompletedAt: stored[PREF_KEYS.syncLastCompletedAt] ?? null,
      lastAttemptedAt: stored[PREF_KEYS.syncLastAttemptedAt] ?? null,
      lastStatus: lastStatus === "ok" || lastStatus === "error" ? lastStatus : null,
      lastError: stored[PREF_KEYS.syncLastError] || null,
      lastErrorHint: stored[PREF_KEYS.syncLastErrorHint] || null,
      bookCount: this.books.count(),
      inLibraryCount: this.books.inLibraryCount(),
      intervalMinutes: syncIntervalMinutes(stored[PREF_KEYS.syncIntervalMinutes]),
      configured: Boolean(this.deps.calibreServerUrl()),
    };
  }

  // --- scheduling -----------------------------------------------------------

  /**
   * Start the timer and sync once now. Called on boot and whenever the content
   * server URL changes, so a freshly configured library appears without waiting
   * out an interval.
   */
  start(): void {
    this.stopped = false;
    void this.syncNow().catch(() => {
      // Recorded in preferences and surfaced by the indicator; a failed sync is
      // not a reason to take the process down.
    });
    this.scheduleNext();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Re-read the interval and re-arm. Called after the preference changes. */
  reschedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.scheduleNext();
  }

  private scheduleNext(): void {
    if (this.stopped) return;
    const minutes = syncIntervalMinutes(this.settings.get(PREF_KEYS.syncIntervalMinutes));
    if (minutes <= 0) return; // "never"

    this.timer = setTimeout(
      () => {
        void this.syncNow()
          .catch(() => {})
          .finally(() => this.scheduleNext());
      },
      minutes * 60 * 1000,
    );
    // Don't hold the process open for a timer nobody is waiting on.
    this.timer.unref?.();
  }

  // --- running --------------------------------------------------------------

  /**
   * Run a sync, or join the one already in flight. Single-flight rather than
   * queued: two syncs of the same library produce the same result, so a second
   * caller wants the first one's answer, not another pass.
   *
   * `full` ignores the watermark and refetches every book, which is what a
   * manual sync does — so "it looks wrong, re-sync" is a real remedy rather
   * than a no-op.
   */
  syncNow(full = false): Promise<SyncOutcome> {
    if (this.running) return this.running;

    this.running = this.run(full).finally(() => {
      this.running = null;
      this.progress = null;
    });
    return this.running;
  }

  private async run(full: boolean): Promise<SyncOutcome> {
    const now = new Date().toISOString();
    this.settings.set(PREF_KEYS.syncLastAttemptedAt, now);

    try {
      const outcome = await this.runPhases(now, full);
      this.settings.setMany({
        [PREF_KEYS.syncLastCompletedAt]: new Date().toISOString(),
        [PREF_KEYS.syncLastStatus]: "ok",
        [PREF_KEYS.syncLastError]: "",
        [PREF_KEYS.syncLastErrorHint]: "",
      });
      return outcome;
    } catch (err) {
      // The failure stays in preferences until a sync succeeds, so a 3am
      // failure is still on screen at 9am.
      this.settings.setMany({
        [PREF_KEYS.syncLastStatus]: "error",
        [PREF_KEYS.syncLastError]: err instanceof Error ? err.message : String(err),
        [PREF_KEYS.syncLastErrorHint]: err instanceof SyncError ? (err.hint ?? "") : "",
      });
      throw err;
    }
  }

  private async runPhases(now: string, full: boolean): Promise<SyncOutcome> {
    const base = this.deps.calibreServerUrl();
    if (!base) {
      throw new SyncError(
        "No Calibre content server is configured yet.",
        "Add one in Settings → Library.",
      );
    }

    const mirrored = await this.phaseMirror(base, now, full);

    // Reconcile rewrites every row it is given, so running it on an unchanged
    // mirror costs a full table's worth of writes every tick for nothing. Skip
    // it when phase 1 touched nothing — but only if `books` already agrees with
    // the mirror, so a reconcile that never ran (or died half way) still gets
    // its chance on the next tick rather than waiting for Calibre to change.
    const inSync = this.books.inLibraryCount() === this.mirror.count();
    let reconciled: ReconcileResult = { inserted: 0, updated: 0, unlinked: 0 };
    if (mirrored.changed || !inSync) {
      this.progress = { phase: "reconcile", done: 0, total: null };
      reconciled = this.books.reconcileFromCalibre(this.mirror.all(), now);
    }

    // A new or edited book may be the other half of one already here from
    // another source (docs/features/book-matching.md). Cheap enough to run
    // every time: one indexed query and a handful of updates.
    if (reconciled.inserted > 0 || reconciled.updated > 0) this.works.matchAll();

    const coversFetched = await this.phaseCovers(base, full);

    return {
      ...reconciled,
      removedFromMirror: mirrored.removed,
      remirrored: mirrored.remirrored,
      coversFetched,
    };
  }

  // --- phase 1: mirror ------------------------------------------------------

  private async phaseMirror(
    base: string,
    now: string,
    full: boolean,
  ): Promise<{ removed: number; remirrored: boolean; changed: boolean }> {
    this.progress = { phase: "mirror", done: 0, total: null };

    // Ids only, newest-modified first — the cheap call, and the one that tells
    // us what Calibre has dropped.
    const search = await this.fetchJson(
      base,
      "/ajax/search?num=100000&sort=last_modified&sort_order=desc",
      CsSearchSchema,
    );
    const libraryId = search.library_id ?? "unknown";
    const ids = search.book_ids;

    const watermark = full ? null : this.settings.get(PREF_KEYS.syncWatermark);
    let sweep = await this.sweep(base, now, ids, libraryId, watermark);

    // The id space no longer means what the mirror says it means: a different
    // library, or a book deleted and re-added onto a recycled id. Start over
    // rather than continuing — a partial sweep would leave rows from both.
    let remirrored = false;
    if (sweep.reassigned) {
      this.mirror.clear();
      this.settings.delete(PREF_KEYS.syncWatermark);
      sweep = await this.sweep(base, now, ids, libraryId, null);
      remirrored = true;
    }

    const removed = this.mirror.deleteMissing(ids);
    if (sweep.newest) this.settings.set(PREF_KEYS.syncWatermark, sweep.newest);

    return { removed, remirrored, changed: sweep.upserts > 0 || removed > 0 || remirrored };
  }

  /**
   * Walk the id list, upserting metadata, stopping as early as the watermark
   * allows. Returns immediately if it finds the id space has been reassigned —
   * everything it has written by then is about to be thrown away anyway.
   */
  private async sweep(
    base: string,
    now: string,
    ids: number[],
    libraryId: string,
    watermark: string | null,
  ): Promise<{ reassigned: boolean; newest: string; upserts: number }> {
    this.progress = { phase: "mirror", done: 0, total: ids.length };

    // Sentinels ride along with the first page. See CalibreBooksStore.sentinelIds.
    const sentinels = this.mirror.sentinelIds(SENTINEL_COUNT);
    let newest = watermark ?? "";
    let done = 0;
    let upserts = 0;

    for (let offset = 0; offset < ids.length; offset += PAGE_SIZE) {
      const page = ids.slice(offset, offset + PAGE_SIZE);
      const request = offset === 0 ? [...new Set([...page, ...sentinels])] : page;

      const meta = await this.fetchJson(
        base,
        `/ajax/books?ids=${request.join(",")}`,
        CsBooksSchema,
      );

      // What we currently believe these ids mean, read *before* this page is
      // written over it.
      const held = this.mirror.identities(request);
      const reassigned = request.some((id) => {
        const uuid = meta[String(id)]?.uuid;
        const previous = held.get(id);
        return uuid !== undefined && previous !== undefined && uuid !== previous.uuid;
      });
      if (reassigned) return { reassigned: true, newest: "", upserts };

      let sawChange = false;
      let sawUnknown = false;
      for (const id of page) {
        const book = meta[String(id)];
        if (!book) continue;

        const previous = held.get(id);
        if (!previous) sawUnknown = true;
        const lastModified = book.last_modified ?? now;
        if (lastModified > newest) newest = lastModified;
        if (!watermark || lastModified > watermark) sawChange = true;

        // The first page is always fetched, watermark or not, so most ticks see
        // 200 books they already hold, unchanged. Writing them back would be a
        // table's worth of pointless writes a minute.
        if (previous && previous.last_modified === lastModified) {
          done++;
          continue;
        }
        upserts++;

        this.mirror.upsert(id, libraryId, book, book, now);
        done++;
      }
      this.progress = { phase: "mirror", done, total: ids.length };

      // Sorted by last_modified descending, so once a whole page sits at or
      // below the watermark everything after it does too. A book we have never
      // seen still forces a fetch — one can be added carrying an old timestamp.
      if (watermark && !sawChange && !sawUnknown) break;
    }

    return { reassigned: false, newest, upserts };
  }

  // --- phase 3: covers ------------------------------------------------------

  private async phaseCovers(base: string, full: boolean): Promise<number> {
    // A full sync also re-tries the covers that failed last time: a content
    // server that was restarting marks every book it was asked about `missing`,
    // and the stamp it leaves means nothing would ask again.
    const targets = this.books.coversToFetch(full);

    // `covers/` is disposable — deleting it should cost a re-sync and nothing
    // else (ADR 0007). But the database still says those covers are cached, so
    // nothing above would notice they are gone. A full sync therefore checks the
    // filesystem and re-queues whatever is missing. Incremental ticks skip it:
    // three stats per book every minute is not a price worth paying to catch
    // someone deleting files behind our back.
    if (full) targets.push(...(await this.missingCoverTargets()));

    this.progress = { phase: "covers", done: 0, total: targets.length };
    if (targets.length === 0) return 0;

    let done = 0;
    let fetched = 0;

    // A hand-rolled pool rather than one big Promise.all: a first sync of a
    // large library is thousands of images, and Calibre is scaling every one.
    const queue = [...targets];
    const workers = Array.from({ length: Math.min(COVER_CONCURRENCY, queue.length) }, async () => {
      for (;;) {
        const target = queue.shift();
        if (!target) return;

        const ok = await this.fetchCovers(base, target.id, target.calibreId);
        this.books.markCover(target.id, ok ? "cached" : "missing", target.lastModified);
        if (ok) fetched++;

        done++;
        this.progress = { phase: "covers", done, total: targets.length };
      }
    });

    await Promise.all(workers);
    return fetched;
  }

  /**
   * Books the database calls `cached` whose files are not actually on disk, so a
   * deleted cover cache rebuilds itself on the next full sync. Only books still
   * in Calibre can be re-fetched; one that has left keeps whatever it has.
   */
  private async missingCoverTargets(): Promise<CoverTarget[]> {
    const missing: CoverTarget[] = [];
    for (const target of this.books.cachedCoverTargets()) {
      if (!(await this.covers.hasAll(target.id))) missing.push(target);
    }
    return missing;
  }

  /** All three sizes for one book. Any failure leaves the book marked `missing`. */
  private async fetchCovers(base: string, bookId: number, calibreId: number): Promise<boolean> {
    for (const size of COVER_SIZE_NAMES) {
      const url = new URL(CoverStore.calibrePath(calibreId, size), `${base.replace(/\/+$/, "")}/`);

      let res: Response;
      try {
        res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      } catch {
        return false;
      }
      // A book with no cover 404s here — expected, not an error worth failing
      // the whole sync over. The views already draw a placeholder.
      if (!res.ok) return false;

      await this.covers.write(bookId, size, await res.arrayBuffer());
    }
    return true;
  }

  // --- plumbing -------------------------------------------------------------

  private async fetchJson<S extends z.ZodType>(
    base: string,
    path: string,
    schema: S,
  ): Promise<z.infer<S>> {
    const url = new URL(path.replace(/^\//, ""), `${base.replace(/\/+$/, "")}/`);

    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (err) {
      throw new SyncError(
        `Could not reach the Calibre content server at ${base}` +
          (err instanceof Error ? ` (${err.message})` : ""),
        "Start it with `calibre-server` (or calibre Preferences → Sharing over the net), then check the content server URL in Grimoire's settings.",
      );
    }

    if (!res.ok) {
      throw new SyncError(`${base} responded ${res.status} ${res.statusText}`);
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new SyncError(
        `${base} answered, but not like a Calibre content server.`,
        "Check the URL and that the content server is running.",
      );
    }

    try {
      return schema.parse(body);
    } catch (err) {
      throw new SyncError(
        `The Calibre content server sent something unexpected for ${path}` +
          (err instanceof Error ? `: ${err.message}` : ""),
      );
    }
  }
}
