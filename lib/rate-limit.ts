export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
}

interface BucketState {
  timestamps: number[];
}

const buckets = new Map<string, BucketState>();
let sweepCounter = 0;

function sweepExpired(now: number, maxWindowMs: number): void {
  sweepCounter++;
  if (sweepCounter % 50 !== 0) return;
  for (const [k, state] of buckets.entries()) {
    const fresh = state.timestamps.filter((ts) => now - ts < maxWindowMs);
    if (fresh.length === 0) buckets.delete(k);
    else state.timestamps = fresh;
  }
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
  nowMs: number = Date.now()
): RateLimitResult {
  const safeKey = String(key || 'anonymous').slice(0, 120);
  const windowMs = Math.max(1000, config.windowMs);
  const maxRequests = Math.max(1, config.maxRequests);

  sweepExpired(nowMs, windowMs);

  const existing = buckets.get(safeKey);
  const activeTimestamps = existing
    ? existing.timestamps.filter((ts) => nowMs - ts < windowMs)
    : [];

  if (activeTimestamps.length >= maxRequests) {
    const oldest = activeTimestamps[0] ?? nowMs;
    const resetAt = oldest + windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - nowMs) / 1000));
    buckets.set(safeKey, { timestamps: activeTimestamps });
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
      resetAt,
    };
  }

  activeTimestamps.push(nowMs);
  buckets.set(safeKey, { timestamps: activeTimestamps });
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - activeTimestamps.length),
    retryAfterSeconds: 0,
    resetAt: (activeTimestamps[0] ?? nowMs) + windowMs,
  };
}

export function clearRateLimitBuckets(): void {
  buckets.clear();
}

export function getClientIpFromHeaders(headers: {
  get(name: string): string | null;
}): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'unknown-client';
}
