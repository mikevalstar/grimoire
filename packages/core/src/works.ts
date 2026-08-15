import type { Database } from "bun:sqlite";
import { resolveDatabase } from "./db.ts";
import { isPrefixable, keyPrefixes, sharesAuthor } from "./matching.ts";
import type {
  DuplicateCandidate,
  DuplicateReason,
  Duplicates,
  MatchOutcome,
  PendingDuplicates,
  WorkMember,
} from "./schemas.ts";

/**
 * What one pass of the matcher did: `grouped` is books moved into a work they
 * weren't in, `conflicts` is groups left alone because merging them would put
 * two rows of one source together — the queue the manual pass will consume
 * (docs/features/book-matching.md). The shape is a schema, like every payload
 * (ADR 0009), because this one is served by POST /api/match.
 */
export type { MatchOutcome } from "./schemas.ts";

/** Just enough of a book to decide whether it is the same book as another. */
interface Candidate {
  id: number;
  work_id: number;
  source: string;
  match_key: string;
  authors: string;
  work_pinned: number;
}

/** A member row, plus what a suggestion has to compare against. */
interface MemberRow {
  id: number;
  work_id: number;
  source: string;
  title: string;
  authors: string;
  match_key: string | null;
}

/**
 * How confident a suggestion is, best first — and the order the panel lists
 * them in (docs/features/resolving-duplicates.md).
 */
const REASON_RANK: Record<DuplicateReason, number> = { exact: 0, subtitle: 1, title: 2 };

/**
 * A panel is not a report. Past a handful of suggestions the answer is a
 * library-wide review screen, not a longer list under one book.
 */
const MAX_CANDIDATES = 8;

/** Queue rows worth rendering in settings — a pane, not a report. */
const MAX_PENDING = 50;

/** Above every key a range scan could reach, so `>= key AND < KEY_CEILING` is "starts with". */
const KEY_CEILING = "\u{10FFFF}";

function parseAuthors(json: string): string[] {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value.filter((name) => typeof name === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Grouping book rows into works (ADR 0013), and the automatic pass that decides
 * which rows belong together (docs/features/book-matching.md).
 *
 * The matcher is built to be narrow. A duplicate it misses is a cosmetic
 * annoyance; two different books it declares identical corrupts someone's
 * library, and there is no undo yet.
 */
export class WorksStore {
  private db: Database;

  constructor(source?: Database | string) {
    this.db = resolveDatabase(source);
  }

  count(): number {
    const row = this.db.query("SELECT COUNT(*) AS n FROM works").get() as { n: number };
    return row.n;
  }

  /**
   * Group every book that obviously belongs with another. Safe to run after
   * every sync: books already sharing a work are left alone, and anything it
   * refused once it refuses again, so a second pass changes nothing.
   */
  matchAll(): MatchOutcome {
    const rows = this.db
      .query(
        `SELECT id, work_id, source, match_key, authors, work_pinned
           FROM books
          WHERE match_key IS NOT NULL AND work_id IS NOT NULL
          ORDER BY match_key, id`,
      )
      .all() as Candidate[];

    const byKey = new Map<string, Candidate[]>();
    for (const row of rows) {
      // A pinned book is one a human placed. The matcher does not get a say.
      if (row.work_pinned) continue;
      const group = byKey.get(row.match_key);
      if (group) group.push(row);
      else byKey.set(row.match_key, [row]);
    }

    // Pairs somebody has already ruled out. Read once for the whole pass, since
    // the alternative is a lookup per comparison (docs/features/resolving-duplicates.md).
    const ruledOut = this.ruledOutPairs();
    const outcome: MatchOutcome = { grouped: 0, conflicts: 0 };

    this.db.transaction(() => {
      for (const group of byKey.values()) {
        if (group.length < 2) continue;
        for (const cluster of clustersByAuthor(group, ruledOut)) {
          if (cluster.length < 2) continue;

          // Two rows from one source are two editions, a re-import, or a
          // mistake — a question for a person. Transitivity can drag one in
          // (calibre ↔ hardcover ↔ calibre), so the whole cluster is left alone
          // rather than merging the part that looks safe.
          if (new Set(cluster.map((book) => book.source)).size !== cluster.length) {
            outcome.conflicts++;
            continue;
          }

          outcome.grouped += this.mergeIntoOneWork(cluster);
        }
      }
      this.deleteEmptyWorks();
    })();

    return outcome;
  }

  /**
   * Put a cluster in one work, keeping the *oldest* of the works involved: it is
   * the one a rating is most likely already attached to, and keeping it means
   * grouping a book never moves the stars someone already gave it.
   */
  private mergeIntoOneWork(cluster: Candidate[]): number {
    const target = Math.min(...cluster.map((book) => book.work_id));
    const moving = cluster.filter((book) => book.work_id !== target);
    if (moving.length === 0) return 0;

    const move = this.db.query("UPDATE books SET work_id = $workId WHERE id = $id");
    for (const book of moving) {
      move.run({ $workId: target, $id: book.id });
      book.work_id = target;
    }
    return moving.length;
  }

  /**
   * The entries this work is made of, and the ones that look like they belong
   * in it (docs/features/resolving-duplicates.md). Null for a work with no
   * rows, which is a work that doesn't exist.
   *
   * Computed on demand rather than stored: every rule the automatic pass
   * enforces is relaxed to a *label* here, and a person reads the result — so
   * there is nothing worth keeping that couldn't go stale.
   */
  duplicatesFor(workId: number): Duplicates | null {
    const members = this.db
      .query(
        `SELECT id, work_id, source, title, authors, match_key
           FROM books WHERE work_id = $workId ORDER BY id`,
      )
      .all({ $workId: workId }) as MemberRow[];
    if (members.length === 0) return null;

    const ruledOut = this.ruledOutPairs();
    // Best reason per candidate *work*: two members of this work can each match
    // the same one, and it is one suggestion either way.
    const best = new Map<number, DuplicateCandidate>();

    for (const member of members) {
      for (const other of this.candidateRows(member)) {
        const reason = classify(member, other);
        if (!reason) continue;
        if (ruledOut.get(member.id)?.has(other.id)) continue;

        const found = best.get(other.work_id);
        if (!found || REASON_RANK[reason] < REASON_RANK[found.reason]) {
          best.set(other.work_id, {
            workId: other.work_id,
            bookId: member.id,
            otherBookId: other.id,
            reason,
          });
        }
      }
    }

    const candidates = [...best.values()]
      .sort((a, b) => REASON_RANK[a.reason] - REASON_RANK[b.reason] || a.workId - b.workId)
      .slice(0, MAX_CANDIDATES);

    return { members: members.map(toMember), candidates };
  }

  /**
   * The review queue (docs/features/resolving-duplicates.md): every pair
   * `duplicatesFor` would suggest, across the whole library, each pair once —
   * the same suggestion is found from both of its works, and it is one
   * question. Computed on demand like the per-work list, for the same reason:
   * an answer removes it, so there is nothing worth keeping that couldn't go
   * stale. Best reasons first, capped; `total` says what the cap hid.
   */
  pendingDuplicates(limit = MAX_PENDING): PendingDuplicates {
    const workIds = this.db
      .query("SELECT DISTINCT work_id AS id FROM books ORDER BY work_id")
      .all() as { id: number }[];

    const seen = new Set<string>();
    const pairs = [];
    for (const work of workIds) {
      for (const candidate of this.duplicatesFor(work.id)?.candidates ?? []) {
        const [low, high] =
          work.id < candidate.workId ? [work.id, candidate.workId] : [candidate.workId, work.id];
        const key = `${low}:${high}`;
        if (seen.has(key)) continue;
        seen.add(key);
        // Spread first: the candidate's own workId names the *other* work.
        pairs.push({ ...candidate, workId: work.id, otherWorkId: candidate.workId });
      }
    }

    pairs.sort((a, b) => REASON_RANK[a.reason] - REASON_RANK[b.reason] || a.workId - b.workId);
    return { pairs: pairs.slice(0, limit), total: pairs.length };
  }

  /**
   * The rows worth comparing one member against: those whose match key starts
   * with its own — which covers both an exact match and a subtitled edition of
   * it — and those whose key this member's own key extends.
   *
   * Two range-friendly queries rather than a scan with LIKE, so both stay on
   * the `books_match_key` index.
   */
  private candidateRows(member: MemberRow): MemberRow[] {
    const key = member.match_key;
    if (!key || !isPrefixable(key)) return [];

    const rows = this.db
      .query(
        `SELECT id, work_id, source, title, authors, match_key
           FROM books
          WHERE work_id != $workId AND match_key >= $lo AND match_key < $hi`,
      )
      .all({ $workId: member.work_id, $lo: key, $hi: `${key}${KEY_CEILING}` }) as MemberRow[];

    const prefixes = keyPrefixes(key);
    if (prefixes.length > 0) {
      const names = prefixes.map((_, index) => `$p${index}`);
      const params: Record<string, string | number> = { $workId: member.work_id };
      prefixes.forEach((prefix, index) => {
        params[`$p${index}`] = prefix;
      });

      rows.push(
        ...(this.db
          .query(
            `SELECT id, work_id, source, title, authors, match_key
               FROM books
              WHERE work_id != $workId AND match_key IN (${names.join(", ")})`,
          )
          .all(params) as MemberRow[]),
      );
    }

    return rows;
  }

  /**
   * These two books are not the same book — a person's answer, kept so neither
   * the suggestion nor the matcher raises it again.
   *
   * The pair names two *rows*, because a row is the stable thing, but the
   * answer is about the two books on screen: a work is one book, so if this row
   * isn't that one, no member of either work is. The record is therefore every
   * pair across the two works. Recording only the pair that raised the
   * suggestion would leave the same question to be asked again through a
   * sibling row — and would let the matcher merge the works through it.
   *
   * Deliberately *not* a pin: pinning would freeze these rows against every
   * future grouping, where this rules out one pairing and leaves the rest of
   * their lives alone. False when either id isn't a real book, or when the two
   * are already in one work — that question is `separate`, not this one.
   */
  ruleOut(bookId: number, otherBookId: number, now: string): boolean {
    if (bookId === otherBookId) return false;

    const ends = this.db
      .query("SELECT id, work_id FROM books WHERE id IN ($a, $b)")
      .all({ $a: bookId, $b: otherBookId }) as { id: number; work_id: number }[];
    const [one, two] = ends;
    if (ends.length !== 2 || !one || !two || one.work_id === two.work_id) return false;

    const membersOf = (workId: number) =>
      (
        this.db.query("SELECT id FROM books WHERE work_id = $workId").all({ $workId: workId }) as {
          id: number;
        }[]
      ).map((row) => row.id);

    const insert = this.db.query(
      `INSERT INTO book_not_duplicates (book_id, other_book_id, created_at)
       VALUES ($low, $high, $now) ON CONFLICT DO NOTHING`,
    );

    this.db.transaction(() => {
      for (const here of membersOf(one.work_id)) {
        for (const there of membersOf(two.work_id)) {
          const [low, high] = here < there ? [here, there] : [there, here];
          insert.run({ $low: low, $high: high, $now: now });
        }
      }
    })();
    return true;
  }

  /**
   * These two works are the same book: put every row in one, and pin them all
   * so the matcher never reconsiders what a person decided. Answers with the
   * work that survived, or null if either id names nothing.
   *
   * The *older* work wins, as in the automatic pass — it is the one a rating is
   * most likely already attached to.
   */
  link(workId: number, otherWorkId: number): number | null {
    if (workId === otherWorkId) return null;

    const found = this.db
      .query("SELECT DISTINCT work_id FROM books WHERE work_id IN ($a, $b)")
      .all({ $a: workId, $b: otherWorkId }) as { work_id: number }[];
    if (found.length !== 2) return null;

    const target = Math.min(workId, otherWorkId);
    const losing = Math.max(workId, otherWorkId);

    this.db.transaction(() => {
      // Before the row goes: ratings cascade off `works`, so a merge that
      // deleted first would take the losing work's stars with it. Where both
      // were rated the higher stands — the rule ADR 0013's migration set.
      this.db
        .query(
          `INSERT INTO ratings (user_id, work_id, rating, updated_at)
             SELECT user_id, $target, rating, updated_at FROM ratings WHERE work_id = $losing
           ON CONFLICT (user_id, work_id) DO UPDATE
             SET rating = MAX(rating, excluded.rating), updated_at = excluded.updated_at`,
        )
        .run({ $target: target, $losing: losing });

      // A cover somebody chose outlives its work; the rule only picks again if
      // nobody ever chose for the survivor.
      this.db
        .query(
          `UPDATE works SET cover_book_id = (SELECT cover_book_id FROM works WHERE id = $losing)
            WHERE id = $target AND cover_book_id IS NULL`,
        )
        .run({ $target: target, $losing: losing });

      // "Same book" retracts an earlier "not the same book" about the same two
      // rows — a reader is allowed to change their mind, and leaving the old
      // answer behind would have the database holding both.
      this.db
        .query(
          `DELETE FROM book_not_duplicates
            WHERE (book_id IN (SELECT id FROM books WHERE work_id = $target)
                   AND other_book_id IN (SELECT id FROM books WHERE work_id = $losing))
               OR (book_id IN (SELECT id FROM books WHERE work_id = $losing)
                   AND other_book_id IN (SELECT id FROM books WHERE work_id = $target))`,
        )
        .run({ $target: target, $losing: losing });

      this.db
        .query(
          "UPDATE books SET work_id = $target, work_pinned = 1 WHERE work_id IN ($target, $losing)",
        )
        .run({ $target: target, $losing: losing });

      this.deleteEmptyWorks();
    })();

    return target;
  }

  /**
   * Move one row back out into a work of its own — the undo for a merge, and
   * the fix for one the matcher got wrong. The reader stays on the work they
   * were looking at, which keeps its ratings; the row leaves with nothing but
   * itself.
   *
   * Every pair it breaks is recorded as not-a-duplicate, or the next sync would
   * put it straight back on the evidence that grouped it in the first place.
   */
  separate(workId: number, bookId: number, now: string): boolean {
    const members = this.db
      .query("SELECT id FROM books WHERE work_id = $workId ORDER BY id")
      .all({ $workId: workId }) as { id: number }[];
    const remaining = members.filter((member) => member.id !== bookId);
    if (members.length === remaining.length || remaining.length === 0) return false;

    this.db.transaction(() => {
      const work = this.db
        .query("INSERT INTO works (created_at) VALUES ($now) RETURNING id")
        .get({ $now: now }) as { id: number };

      this.db
        .query("UPDATE books SET work_id = $workId, work_pinned = 1 WHERE id = $id")
        .run({ $workId: work.id, $id: bookId });
      this.db
        .query("UPDATE books SET work_pinned = 1 WHERE work_id = $workId")
        .run({ $workId: workId });

      // The work's chosen cover can't be a row that has left it.
      this.db
        .query(
          "UPDATE works SET cover_book_id = NULL WHERE id = $workId AND cover_book_id = $bookId",
        )
        .run({ $workId: workId, $bookId: bookId });

      const rule = this.db.query(
        `INSERT INTO book_not_duplicates (book_id, other_book_id, created_at)
         VALUES ($low, $high, $now) ON CONFLICT DO NOTHING`,
      );
      for (const member of remaining) {
        const [low, high] = bookId < member.id ? [bookId, member.id] : [member.id, bookId];
        rule.run({ $low: low, $high: high, $now: now });
      }
    })();

    return true;
  }

  /** Every ruled-out pair, both ways round, for looking up by either row. */
  private ruledOutPairs(): Map<number, Set<number>> {
    const rows = this.db.query("SELECT book_id, other_book_id FROM book_not_duplicates").all() as {
      book_id: number;
      other_book_id: number;
    }[];

    const pairs = new Map<number, Set<number>>();
    const add = (a: number, b: number) => {
      const set = pairs.get(a);
      if (set) set.add(b);
      else pairs.set(a, new Set([b]));
    };
    for (const row of rows) {
      add(row.book_id, row.other_book_id);
      add(row.other_book_id, row.book_id);
    }
    return pairs;
  }

  /** Works nothing points at any more, left behind by a merge. */
  private deleteEmptyWorks(): void {
    this.db.run(
      "DELETE FROM works WHERE id NOT IN (SELECT work_id FROM books WHERE work_id IS NOT NULL)",
    );
  }

  close(): void {
    this.db.close();
  }
}

/**
 * Split books sharing a title into clusters that also share an author.
 * `Persuasion` by Jane Austen and `Persuasion` by Robert Cialdini share a match
 * key and are not the same book.
 *
 * Union by scanning: a book joins the first cluster it shares an author with,
 * which makes co-authored books transitive — A and C group through B even
 * though they list no author in common. That is the intent; two books with the
 * same title, connected by an author, are the same book.
 */
function clustersByAuthor(group: Candidate[], ruledOut: Map<number, Set<number>>): Candidate[][] {
  const clusters: { books: Candidate[]; authors: string[] }[] = [];

  for (const book of group) {
    const authors = parseAuthors(book.authors);
    // No authors at all is a candidate for a human, never a match.
    if (authors.length === 0) continue;

    const found = clusters.find(
      (cluster) =>
        sharesAuthor(cluster.authors, authors) &&
        // One "not the same book" answer keeps the pair apart, rather than the
        // cluster forming and dragging them together anyway.
        !cluster.books.some((member) => ruledOut.get(member.id)?.has(book.id)),
    );
    if (found) {
      found.books.push(book);
      found.authors.push(...authors);
    } else {
      clusters.push({ books: [book], authors: [...authors] });
    }
  }

  return clusters.map((cluster) => cluster.books);
}

/**
 * Why these two rows might be the same book, or null when they aren't worth
 * suggesting (docs/features/resolving-duplicates.md).
 *
 * The author check the matcher gates on becomes a caveat for an equal title —
 * a person can read "different author" and decide — but it stays a gate for a
 * title that merely *starts* the other, where a shared prefix on its own would
 * suggest every book in a series to every other one.
 */
function classify(member: MemberRow, other: MemberRow): DuplicateReason | null {
  if (!member.match_key || !other.match_key) return null;

  const shared = sharesAuthor(parseAuthors(member.authors), parseAuthors(other.authors));
  if (member.match_key === other.match_key) return shared ? "exact" : "title";
  return shared ? "subtitle" : null;
}

/** A member row as the panel lists it — its own title, not the work's merged one. */
function toMember(row: MemberRow): WorkMember {
  return {
    bookId: row.id,
    source: row.source,
    title: row.title,
    authors: parseAuthors(row.authors),
  };
}
