import type { Database } from "bun:sqlite";
import { resolveDatabase } from "./db.ts";
import { sharesAuthor } from "./matching.ts";
import type { MatchOutcome } from "./schemas.ts";

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

    const outcome: MatchOutcome = { grouped: 0, conflicts: 0 };

    this.db.transaction(() => {
      for (const group of byKey.values()) {
        if (group.length < 2) continue;
        for (const cluster of clustersByAuthor(group)) {
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
function clustersByAuthor(group: Candidate[]): Candidate[][] {
  const clusters: { books: Candidate[]; authors: string[] }[] = [];

  for (const book of group) {
    const authors = parseAuthors(book.authors);
    // No authors at all is a candidate for a human, never a match.
    if (authors.length === 0) continue;

    const found = clusters.find((cluster) => sharesAuthor(cluster.authors, authors));
    if (found) {
      found.books.push(book);
      found.authors.push(...authors);
    } else {
      clusters.push({ books: [book], authors: [...authors] });
    }
  }

  return clusters.map((cluster) => cluster.books);
}
