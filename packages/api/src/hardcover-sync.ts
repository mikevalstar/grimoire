import type { Database } from "bun:sqlite";
import {
  BooksStore,
  CoverStore,
  HardcoverBooksStore,
  UsersStore,
  WorksStore,
} from "@grimoire/core";
import { fetchShelfPage, HardcoverError, PAGE_SIZE, probeHardcover } from "./hardcover.ts";
import { cacheRemoteCover, REMOTE_COVER_CONCURRENCY } from "./remote-covers.ts";

/**
 * The Hardcover sync (docs/features/hardcover-sync.md): pull every book on a
 * linked reader's shelves into the mirror, then fold the books into `books`.
 *
 * **This sync matches nothing itself.** A book in both libraries keeps two
 * rows; the matcher runs once the sweep has written them and groups the pair
 * under one work (docs/features/book-matching.md), so the shelf shows one card.
 *
 * One instance per Grimoire process; one sync at a time per reader.
 */

/**
 * Their limit is 60 requests a minute. Pacing pages a second apart keeps a
 * large library inside it without any bookkeeping — and a sweep is sequential,
 * so this is the whole rate limiter.
 */
const PAGE_PAUSE_MS = 1_000;

/**
 * A stop, not a target: 200 pages is 20,000 books, past which something is
 * wrong with the paging rather than with the reader's ambitions.
 */
const MAX_PAGES = 200;

/**
 * Fixed rather than a preference. Every sync is a full sweep of someone's
 * library against a rate-limited API, which is not something to invite anyone
 * to run every minute — and there is no incremental sweep yet to make it cheap.
 */
const INTERVAL_MINUTES = 60;

export interface HardcoverSyncOutcome {
  /** Shelf entries seen on Hardcover. */
  entries: number;
  /** Entries dropped because the book left their shelves. */
  removed: number;
  /** New `books` rows — before matching decides which are the same book. */
  inserted: number;
  updated: number;
  /** Covers downloaded from Hardcover's CDN and scaled onto disk. */
  coversFetched: number;
}

export class HardcoverSync {
  private readonly users: UsersStore;
  private readonly mirror: HardcoverBooksStore;
  private readonly books: BooksStore;
  private readonly works: WorksStore;
  private readonly covers: CoverStore;

  /** In flight, by reader — so two clicks join one sweep instead of racing. */
  private readonly running = new Map<number, Promise<HardcoverSyncOutcome>>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(db: Database, dataDir: string) {
    this.users = new UsersStore(db);
    this.mirror = new HardcoverBooksStore(db);
    this.books = new BooksStore(db);
    this.works = new WorksStore(db);
    this.covers = new CoverStore(dataDir);
  }

  // --- scheduling -----------------------------------------------------------

  start(): void {
    this.stopped = false;
    void this.syncAll();
    this.scheduleNext();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private scheduleNext(): void {
    if (this.stopped) return;
    this.timer = setTimeout(
      () => {
        void this.syncAll().finally(() => this.scheduleNext());
      },
      INTERVAL_MINUTES * 60 * 1000,
    );
    this.timer.unref?.();
  }

  /**
   * Every linked reader, one after another rather than at once: they are
   * separate accounts with separate rate limits, but they share one process and
   * one database, and nobody is waiting on this.
   */
  async syncAll(): Promise<void> {
    for (const userId of this.users.linkedToHardcover()) {
      // One reader's expired token must not stop the next reader syncing.
      await this.syncUser(userId).catch(() => {});
    }
  }

  // --- running --------------------------------------------------------------

  /**
   * Sync one reader, or join the sweep already running for them.
   *
   * `full` retries the covers a previous sweep failed to fetch, and re-checks
   * the ones it believes are on disk — what a manual sync does, so that "the
   * covers didn't come down, sync again" is a real remedy rather than a no-op
   * (docs/features/hardcover-sync.md).
   */
  syncUser(userId: number, full = false): Promise<HardcoverSyncOutcome> {
    const inFlight = this.running.get(userId);
    if (inFlight) return inFlight;

    const run = this.run(userId, full).finally(() => this.running.delete(userId));
    this.running.set(userId, run);
    return run;
  }

  isRunning(userId: number): boolean {
    return this.running.has(userId);
  }

  private async run(userId: number, full: boolean): Promise<HardcoverSyncOutcome> {
    try {
      const outcome = await this.sweep(userId, full);
      this.users.markHardcoverSync(userId, null);
      return outcome;
    } catch (err) {
      this.users.markHardcoverSync(userId, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  private async sweep(userId: number, full: boolean): Promise<HardcoverSyncOutcome> {
    const account = this.users.hardcoverAccount(userId);
    if (!account) throw new HardcoverError("This reader has no Hardcover account linked.");

    // Readers linked before the id was stored — and any whose account id we
    // somehow lost — get it back from a probe rather than failing.
    let hardcoverUserId = account.userId;
    if (hardcoverUserId === null) {
      const probe = await probeHardcover(account.token);
      if (!probe.ok || probe.userId === undefined) {
        throw new HardcoverError(probe.error ?? "Hardcover did not name the account.");
      }
      this.users.linkHardcover(userId, account.token, probe.username ?? "", probe.userId);
      hardcoverUserId = probe.userId;
    }

    const now = new Date().toISOString();
    const seen: number[] = [];

    for (let page = 0; page < MAX_PAGES; page++) {
      if (page > 0) await Bun.sleep(PAGE_PAUSE_MS);

      const entries = await fetchShelfPage(account.token, hardcoverUserId, page * PAGE_SIZE);
      for (const entry of entries) {
        this.mirror.upsert(userId, entry, now);
        seen.push(entry.book.id);
      }

      // A short page is the last page: their API has no total to compare with.
      if (entries.length < PAGE_SIZE) break;
    }

    const removed = this.mirror.deleteMissing(userId, seen);
    // Every mirrored book, not just this reader's: two readers sharing a book
    // still produce one `books` row, and reconciling the whole mirror is what
    // keeps that true no matter who synced last.
    const reconciled = this.books.reconcileFromHardcover(this.mirror.allBooks(), now);

    // The books that just arrived are the ones most likely to be the other half
    // of something already here from Calibre (docs/features/book-matching.md).
    if (reconciled.inserted > 0 || reconciled.updated > 0) this.works.matchAll();

    // Covers last, for the same reason the Calibre sync does it last: files are
    // named by the book id that reconcile assigns.
    const coversFetched = await this.cacheCovers(full);

    return {
      entries: seen.length,
      removed,
      inserted: reconciled.inserted,
      updated: reconciled.updated,
      coversFetched,
    };
  }

  /**
   * Download every cover we hold only a URL for, and scale it onto disk — so a
   * Hardcover book draws with the network off, like every other book
   * (docs/features/hardcover-sync.md).
   *
   * A hand-rolled pool rather than one Promise.all: a first sync of a large
   * shelf is hundreds of images from someone else's CDN.
   *
   * A full sweep also reconciles what is actually on disk: the failures from
   * last time are tried again, and the covers the database calls cached are
   * stat'd, so a deleted `covers/` tree rebuilds itself. Incremental sweeps do
   * neither — three stats a book every hour to catch someone deleting files
   * behind our back is not a price worth paying.
   */
  private async cacheCovers(full: boolean): Promise<number> {
    const queue = this.books.remoteCoversToFetch(full);
    if (full) queue.push(...(await this.missingRemoteCovers()));
    if (queue.length === 0) return 0;

    let fetched = 0;
    const workers = Array.from(
      { length: Math.min(REMOTE_COVER_CONCURRENCY, queue.length) },
      async () => {
        for (;;) {
          const target = queue.shift();
          if (!target) return;

          const ok = await cacheRemoteCover(this.covers, target.id, target.url);
          // A book whose image can't be fetched is marked rather than retried
          // every sync; a changed URL is what makes us try again.
          this.books.markCover(target.id, ok ? "cached" : "missing", new Date().toISOString());
          if (ok) fetched++;
        }
      },
    );

    await Promise.all(workers);
    return fetched;
  }

  /**
   * Remote covers the database calls cached whose files are not on disk. The
   * Calibre pass rebuilds its own the same way, but it can only re-fetch books
   * with a Calibre id — these have none, so nothing else would ever notice.
   */
  private async missingRemoteCovers(): Promise<{ id: number; url: string }[]> {
    const missing: { id: number; url: string }[] = [];
    for (const target of this.books.cachedRemoteCoverTargets()) {
      if (!(await this.covers.hasAll(target.id))) missing.push(target);
    }
    return missing;
  }
}
