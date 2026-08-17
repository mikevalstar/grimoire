/**
 * Pacing for hardcover.app (ADR 0012). Every request this process makes goes
 * through one of these — see `hardcoverQuery` in hardcover.ts, which is the
 * only place a Hardcover URL is fetched.
 *
 * Their ceiling is 60 requests a minute. A token bucket rather than a fixed
 * pause between calls, because the traffic comes in two very different shapes:
 * a shelf sweep wants a steady sustained rate for thousands of requests, while
 * an open details panel wants its two or three reads to feel instant. A bucket
 * gives an idle process its burst and still holds the sustained rate under the
 * ceiling; a fixed pause would either throttle the panel or overrun the sweep.
 */

/** Under their 60 — headroom for clock skew and for whatever their gateway counts. */
export const HARDCOVER_RATE_LIMIT = 55;

const WINDOW_MS = 60_000;

/** Injectable so tests can run a bucket on a fake clock instead of in real time. */
export interface RateLimiterClock {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

const REAL_CLOCK: RateLimiterClock = {
  now: () => Date.now(),
  sleep: (ms) => Bun.sleep(ms),
};

/**
 * A token bucket that hands out permits in arrival order.
 *
 * `take()` resolves when the caller may send; it never rejects and never
 * refuses, it only waits. `penalize()` is the other half: when Hardcover says
 * 429 anyway, everything queued behind it stops until the penalty is up, so one
 * rate-limited request slows the whole process down rather than the caller
 * that happened to hit the wall.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private blockedUntil = 0;
  /** Serialises `take()`, so permits are granted in the order they were asked for. */
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly capacity: number,
    private readonly clock: RateLimiterClock = REAL_CLOCK,
    private readonly windowMs: number = WINDOW_MS,
  ) {
    this.tokens = capacity;
    this.lastRefill = clock.now();
  }

  /** Tokens per millisecond — the sustained rate the bucket refills at. */
  private get refillRate(): number {
    return this.capacity / this.windowMs;
  }

  /** Wait for a permit. Resolves when the request may go out. */
  take(): Promise<void> {
    const permit = this.tail.then(() => this.consume());
    // A queue that rejects would strand every caller behind it. `consume` only
    // rejects if the injected clock does, but the chain must survive that.
    this.tail = permit.catch(() => {});
    return permit;
  }

  /**
   * Hardcover pushed back: hold every request for `ms` and empty the bucket, so
   * the burst allowance doesn't immediately spend itself back into the wall.
   */
  penalize(ms: number): void {
    this.tokens = 0;
    this.blockedUntil = Math.max(this.blockedUntil, this.clock.now() + ms);
  }

  private async consume(): Promise<void> {
    for (;;) {
      const now = this.clock.now();

      if (now < this.blockedUntil) {
        await this.clock.sleep(this.blockedUntil - now);
        continue;
      }

      this.tokens = Math.min(
        this.capacity,
        this.tokens + (now - this.lastRefill) * this.refillRate,
      );
      this.lastRefill = now;

      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }

      // Sleep exactly long enough for the next whole token, then re-check:
      // a penalty may have landed while we waited.
      await this.clock.sleep(Math.ceil((1 - this.tokens) / this.refillRate));
    }
  }
}

/**
 * One bucket per token, because their limit is per account: a reader's hour-long
 * sweep must not throttle a different reader's open panel. Keyed by the token
 * itself and never evicted — the keys are the linked readers, of which there are
 * as many as there are people using this Grimoire.
 */
const limiters = new Map<string, RateLimiter>();

export function limiterFor(token: string): RateLimiter {
  const key = token.trim();
  const existing = limiters.get(key);
  if (existing) return existing;

  const created = new RateLimiter(HARDCOVER_RATE_LIMIT);
  limiters.set(key, created);
  return created;
}

/**
 * How long a 429 says to wait, from the response itself. `Retry-After` is
 * either seconds or an HTTP date (RFC 9110). Hardcover's gateway is not
 * documented as sending it at all, so this answers null rather than guessing
 * and the caller falls back to its own backoff.
 */
export function retryAfterMs(headers: Headers, now: number = Date.now()): number | null {
  const header = headers.get("retry-after")?.trim();
  // Empty is not zero: `Number("")` is 0, and a blank header means they told us
  // nothing, which the caller answers with its own backoff rather than no wait.
  if (!header) return null;

  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);

  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}
