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
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  name: row.name,
  color: row.color,
  createdAt: row.created_at,
});

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
    const rows = this.db
      .query("SELECT id, name, color, created_at FROM users ORDER BY id")
      .all() as UserRow[];
    return rows.map(toUser);
  }

  get(id: number): User | null {
    const row = this.db
      .query("SELECT id, name, color, created_at FROM users WHERE id = $id")
      .get({ $id: id }) as UserRow | null;
    return row ? toUser(row) : null;
  }

  /** Colour defaults to the first one nobody has taken. */
  create(input: UserCreate): User {
    const name = input.name.trim();
    const color = input.color ?? nextUserColor(this.list().map((user) => user.color));

    let row: UserRow;
    try {
      row = this.db
        .query(
          "INSERT INTO users (name, color, created_at) VALUES ($name, $color, $createdAt) " +
            "RETURNING id, name, color, created_at",
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

  close(): void {
    this.db.close();
  }
}
