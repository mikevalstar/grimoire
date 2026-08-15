import type { Database } from "bun:sqlite";
import { resolveDatabase } from "./db.ts";
import type { User, UserCreate } from "./schemas.ts";
import { nextUserColor } from "./types.ts";

/** A name that's already taken — the API turns this into a 409. */
export class DuplicateUserError extends Error {
  constructor(readonly userName: string) {
    super(`There's already a reader called "${userName}".`);
    this.name = "DuplicateUserError";
  }
}

interface UserRow {
  id: number;
  name: string;
  color: string;
  created_at: string;
  hardcover_username: string | null;
  hardcover_synced_at: string | null;
  hardcover_sync_error: string | null;
  ratings_source: string;
  read_state_source: string;
}

/**
 * The columns a `User` is built from — every one except `hardcover_token`,
 * which is a credential and never leaves the server (ADR 0012). Spelled once so
 * no query grows a `SELECT *` that would quietly put it on the wire.
 */
const USER_COLUMNS =
  "id, name, color, created_at, hardcover_username, hardcover_synced_at, hardcover_sync_error, " +
  "ratings_source, read_state_source";

const toUser = (row: UserRow, hardcover?: HardcoverCounts): User => ({
  id: row.id,
  name: row.name,
  color: row.color,
  createdAt: row.created_at,
  hardcoverUsername: row.hardcover_username,
  hardcoverBookCount: hardcover?.bookCount ?? 0,
  hardcoverStatusCounts: hardcover?.statusCounts ?? [],
  hardcoverSyncedAt: row.hardcover_synced_at,
  hardcoverSyncError: row.hardcover_sync_error || null,
  // Both sources fall back to hardcover — same as the schema promises — and
  // both only take effect for a linked reader anyway.
  ratingsSource: row.ratings_source === "local" ? "local" : "hardcover",
  readStateSource: row.read_state_source === "local" ? "local" : "hardcover",
});

/** A reader's shelf totals, counted from the Hardcover mirror. */
interface HardcoverCounts {
  bookCount: number;
  statusCounts: { statusId: number; count: number }[];
}

/**
 * The people sharing this library. No credentials and no sessions — a user is
 * a name, a colour and an id (ADR 0008). Created by the setup wizard; editing
 * and deleting wait for a settings surface.
 */
export class UsersStore {
  private db: Database;

  constructor(source?: Database | string) {
    this.db = resolveDatabase(source);
  }

  list(): User[] {
    const rows = this.db.query(`SELECT ${USER_COLUMNS} FROM users ORDER BY id`).all() as UserRow[];
    const counts = this.hardcoverCounts();
    return rows.map((row) => toUser(row, counts.get(row.id)));
  }

  get(id: number): User | null {
    const row = this.db
      .query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $id`)
      .get({ $id: id }) as UserRow | null;
    return row ? toUser(row, this.hardcoverCounts().get(id)) : null;
  }

  /**
   * Shelf totals for every reader at once — one grouped query rather than two
   * per reader, since the only caller renders the whole list
   * (docs/features/hardcover-sync.md).
   */
  private hardcoverCounts(): Map<number, HardcoverCounts> {
    const rows = this.db
      .query(
        `SELECT user_id AS userId, status_id AS statusId, COUNT(*) AS count
           FROM hardcover_user_books GROUP BY user_id, status_id ORDER BY status_id`,
      )
      .all() as { userId: number; statusId: number; count: number }[];

    const counts = new Map<number, HardcoverCounts>();
    for (const row of rows) {
      const entry = counts.get(row.userId) ?? { bookCount: 0, statusCounts: [] };
      entry.bookCount += row.count;
      entry.statusCounts.push({ statusId: row.statusId, count: row.count });
      counts.set(row.userId, entry);
    }
    return counts;
  }

  /** Colour defaults to the first one nobody has taken. */
  create(input: UserCreate): User {
    const name = input.name.trim();
    const color = input.color ?? nextUserColor(this.list().map((user) => user.color));

    let row: UserRow;
    try {
      row = this.db
        .query(
          // Stars come from Hardcover by default, set here rather than left to
          // the column default: databases migrated before the flip still carry
          // DEFAULT 'local', and new readers should not inherit that.
          "INSERT INTO users (name, color, created_at, ratings_source) " +
            `VALUES ($name, $color, $createdAt, 'hardcover') RETURNING ${USER_COLUMNS}`,
        )
        .get({
          $name: name,
          $color: color,
          $createdAt: new Date().toISOString(),
        }) as UserRow;
    } catch (err) {
      // The UNIQUE COLLATE NOCASE index on name is the only constraint here.
      if (err instanceof Error && /UNIQUE/i.test(err.message)) {
        throw new DuplicateUserError(name);
      }
      throw err;
    }
    return toUser(row);
  }

  /**
   * Where this reader's stars live (ADR 0014). Applied at once — a rating
   * source is not something with half-typed state to protect.
   */
  setRatingsSource(id: number, source: "local" | "hardcover"): User | null {
    const row = this.db
      .query(`UPDATE users SET ratings_source = $source WHERE id = $id RETURNING ${USER_COLUMNS}`)
      .get({ $id: id, $source: source }) as UserRow | null;
    return row ? toUser(row, this.hardcoverCounts().get(id)) : null;
  }

  /** Same choice for read state (docs/features/marking-a-book-read.md). */
  setReadStateSource(id: number, source: "local" | "hardcover"): User | null {
    const row = this.db
      .query(
        `UPDATE users SET read_state_source = $source WHERE id = $id RETURNING ${USER_COLUMNS}`,
      )
      .get({ $id: id, $source: source }) as UserRow | null;
    return row ? toUser(row, this.hardcoverCounts().get(id)) : null;
  }

  /**
   * This reader's Hardcover credential, for the server to authenticate and
   * query with. The only method that reads the token column, and nothing may
   * put it in a response (ADR 0012).
   */
  hardcoverAccount(id: number): { token: string; userId: number | null } | null {
    const row = this.db
      .query("SELECT hardcover_token, hardcover_user_id FROM users WHERE id = $id")
      .get({ $id: id }) as {
      hardcover_token: string | null;
      hardcover_user_id: number | null;
    } | null;
    return row?.hardcover_token
      ? { token: row.hardcover_token, userId: row.hardcover_user_id }
      : null;
  }

  /** Readers with an account linked — the ones a background sync has work for. */
  linkedToHardcover(): number[] {
    const rows = this.db
      .query("SELECT id FROM users WHERE hardcover_token IS NOT NULL ORDER BY id")
      .all() as { id: number }[];
    return rows.map((row) => row.id);
  }

  /**
   * Store a token that has already authenticated, with the account the probe
   * named. All three together, always: the username is what tells the UI a
   * reader is linked, and the id is what asking for their library takes.
   */
  linkHardcover(id: number, token: string, username: string, userId: number): User | null {
    const row = this.db
      .query(
        "UPDATE users SET hardcover_token = $token, hardcover_username = $username, " +
          `hardcover_user_id = $userId WHERE id = $id RETURNING ${USER_COLUMNS}`,
      )
      .get({ $id: id, $token: token, $username: username, $userId: userId }) as UserRow | null;
    return row ? toUser(row, this.hardcoverCounts().get(id)) : null;
  }

  /**
   * Forget the link, and everything synced under it. Nothing happens on
   * Hardcover's side; the token stays valid there.
   *
   * The reader's shelf entries go, because they describe an account this
   * install no longer speaks for. `books` rows stay — sync never deletes one
   * (ADR 0011), and another reader may hold the same book.
   */
  unlinkHardcover(id: number): User | null {
    const row = this.db.transaction(() => {
      this.db.query("DELETE FROM hardcover_user_books WHERE user_id = $id").run({ $id: id });
      // The rating source goes back to local with the link: a source that can
      // no longer be read or written isn't a choice worth remembering (ADR 0014).
      return this.db
        .query(
          "UPDATE users SET hardcover_token = NULL, hardcover_username = NULL, " +
            "hardcover_user_id = NULL, hardcover_synced_at = NULL, hardcover_sync_error = NULL, " +
            `ratings_source = 'local' WHERE id = $id RETURNING ${USER_COLUMNS}`,
        )
        .get({ $id: id }) as UserRow | null;
    })();
    return row ? toUser(row, this.hardcoverCounts().get(id)) : null;
  }

  /**
   * Record how a reader's sync went. A failure stays until one succeeds, so an
   * expired token is still on screen tomorrow — the same promise the Calibre
   * indicator makes.
   */
  markHardcoverSync(id: number, error: string | null): void {
    this.db
      .query(
        "UPDATE users SET hardcover_synced_at = $syncedAt, hardcover_sync_error = $error " +
          "WHERE id = $id",
      )
      .run({
        $id: id,
        // A failed sync leaves the previous success time alone: "last synced" is
        // when data last arrived, not when we last tried.
        $syncedAt: error ? this.hardcoverSyncedAt(id) : new Date().toISOString(),
        $error: error,
      });
  }

  private hardcoverSyncedAt(id: number): string | null {
    const row = this.db
      .query("SELECT hardcover_synced_at FROM users WHERE id = $id")
      .get({ $id: id }) as { hardcover_synced_at: string | null } | null;
    return row?.hardcover_synced_at ?? null;
  }

  close(): void {
    this.db.close();
  }
}
