import { rateLimited } from "../errors";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Minimal in-process rate limiter for abuse-prone actions (creating requests,
 * reporting, sign-in attempts). A production deployment would move this to Redis
 * or the platform's edge rate limiting.
 */
export function enforceRateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (bucket.count >= limit) {
    const seconds = Math.ceil((bucket.resetAt - now) / 1000);
    throw rateLimited(`Too many attempts. Please try again in ${seconds}s.`);
  }

  bucket.count += 1;
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/** Test helper. */
export function __clearRateLimits(): void {
  buckets.clear();
}
