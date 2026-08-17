import { afterEach, expect, test } from "bun:test";
import { fetchShelfPage, HardcoverError } from "./hardcover.ts";

/**
 * The 429 path, which is the one that used to lose a whole sweep. Every test
 * uses its own token so it gets its own bucket from `limiterFor` — the buckets
 * are process-wide and deliberately never evicted.
 *
 * `Retry-After: 0` keeps the penalty itself instant; what's left is the bucket
 * earning a token back, which is about a second and is the real behaviour.
 */
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function respondWith(statuses: readonly number[]): { calls: number } {
  const state = { calls: 0 };
  // `Object.assign` rather than a cast: `typeof fetch` carries `preconnect`,
  // and borrowing the real one keeps the stub honestly the same type.
  globalThis.fetch = Object.assign(
    async (): Promise<Response> => {
      const status = statuses[Math.min(state.calls, statuses.length - 1)] ?? 200;
      state.calls++;

      if (status === 429) {
        return new Response("{}", { status: 429, headers: { "Retry-After": "0" } });
      }
      if (status !== 200) return new Response("{}", { status });
      return Response.json({ data: { user_books: [] } });
    },
    { preconnect: realFetch.preconnect },
  );
  return state;
}

test("a 429 is retried rather than failing the caller", async () => {
  const attempts = respondWith([429, 200]);

  await expect(fetchShelfPage("token-retries", 1, 0)).resolves.toEqual([]);
  expect(attempts.calls).toBe(2);
});

test("a wall that doesn't move is reported, after the retries are spent", async () => {
  const attempts = respondWith([429]);

  await expect(fetchShelfPage("token-exhausted", 1, 0)).rejects.toBeInstanceOf(HardcoverError);
  expect(attempts.calls).toBe(3);
});

test("a 401 is not retried — a bad token stays bad", async () => {
  const attempts = respondWith([401]);

  await expect(fetchShelfPage("token-unauthorized", 1, 0)).rejects.toBeInstanceOf(HardcoverError);
  expect(attempts.calls).toBe(1);
});
