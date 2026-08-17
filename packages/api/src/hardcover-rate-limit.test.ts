import { describe, expect, test } from "bun:test";
import { RateLimiter, type RateLimiterClock, retryAfterMs } from "./hardcover-rate-limit.ts";

/**
 * A clock the test drives. `sleep` advances it rather than waiting, so a bucket
 * paced over minutes is exercised in microseconds — and every wait the limiter
 * asked for is recorded, which is the thing actually under test.
 */
function fakeClock(): RateLimiterClock & { time: number; waits: number[] } {
  const clock = {
    time: 0,
    waits: [] as number[],
    now: () => clock.time,
    sleep: async (ms: number) => {
      clock.waits.push(ms);
      clock.time += ms;
    },
  };
  return clock;
}

describe("RateLimiter", () => {
  test("spends the burst allowance without waiting", async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter(5, clock, 60_000);

    for (let i = 0; i < 5; i++) await limiter.take();

    expect(clock.waits).toEqual([]);
    expect(clock.time).toBe(0);
  });

  test("holds the sustained rate once the burst is spent", async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter(5, clock, 60_000);

    // Five free, then five more that have to be earned back at 5/minute.
    for (let i = 0; i < 10; i++) await limiter.take();

    expect(clock.waits.length).toBe(5);
    // A minute's window over five tokens is twelve seconds a token.
    expect(clock.time).toBe(60_000);
  });

  test("never exceeds the capacity over a window, however long it idles", async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter(5, clock, 60_000);

    clock.time = 10 * 60_000;
    for (let i = 0; i < 5; i++) await limiter.take();

    // The idle minutes do not accumulate into a bigger burst.
    await limiter.take();
    expect(clock.time).toBeGreaterThan(10 * 60_000);
  });

  test("a penalty stops everything until it is up", async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter(50, clock, 60_000);

    await limiter.take();
    limiter.penalize(30_000);
    await limiter.take();

    expect(clock.time).toBe(30_000);
  });

  test("a penalty empties the bucket, so the burst can't spend straight back in", async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter(50, clock, 60_000);

    // A zero-length penalty is nothing *but* the emptying: with the burst still
    // in hand the next take would be free, and instead it has to earn a token.
    limiter.penalize(0);
    await limiter.take();

    expect(clock.time).toBe(60_000 / 50);
  });

  test("the longer of two overlapping penalties wins", async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter(50, clock, 60_000);

    limiter.penalize(60_000);
    limiter.penalize(10_000);
    await limiter.take();

    expect(clock.time).toBe(60_000);
  });

  test("grants permits in the order they were asked for", async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter(2, clock, 60_000);
    const order: number[] = [];

    await Promise.all(
      [0, 1, 2, 3].map(async (n) => {
        await limiter.take();
        order.push(n);
      }),
    );

    expect(order).toEqual([0, 1, 2, 3]);
  });
});

describe("retryAfterMs", () => {
  test("reads a delay in seconds", () => {
    expect(retryAfterMs(new Headers({ "retry-after": "30" }))).toBe(30_000);
  });

  test("reads an HTTP date, relative to now", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    const headers = new Headers({ "retry-after": "Thu, 01 Jan 2026 00:00:45 GMT" });
    expect(retryAfterMs(headers, now)).toBe(45_000);
  });

  test("a date already past is no wait at all", () => {
    const now = Date.parse("2026-01-01T00:01:00Z");
    const headers = new Headers({ "retry-after": "Thu, 01 Jan 2026 00:00:00 GMT" });
    expect(retryAfterMs(headers, now)).toBe(0);
  });

  test("answers null when there is no header — the caller backs off its own way", () => {
    expect(retryAfterMs(new Headers())).toBeNull();
  });

  test("answers null rather than guessing at nonsense", () => {
    expect(retryAfterMs(new Headers({ "retry-after": "soon" }))).toBeNull();
  });
});
