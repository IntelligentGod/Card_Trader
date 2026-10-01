/**
 * Token bucket limiter used by providers to stay under a source's published
 * request quota. One worker process → in-memory is sufficient for the MVP;
 * with multiple workers this moves to Redis.
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill = Date.now();

  constructor(
    private readonly capacity: number,
    private readonly refillPerMs: number,
  ) {
    this.tokens = capacity;
  }

  static perMinute(requests: number): TokenBucket {
    return new TokenBucket(Math.max(1, Math.floor(requests / 6)), requests / 60_000);
  }

  async acquire(): Promise<void> {
    for (;;) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitMs = Math.ceil((1 - this.tokens) / this.refillPerMs);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  private refill(): void {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + (now - this.lastRefill) * this.refillPerMs);
    this.lastRefill = now;
  }
}

/** Thrown by providers when the source asks us to back off (HTTP 429 etc.). */
export class ProviderRateLimitedError extends Error {
  constructor(
    readonly providerCode: string,
    readonly retryAfterMs: number | null,
  ) {
    super(`${providerCode} rate limited`);
    this.name = 'ProviderRateLimitedError';
  }
}
