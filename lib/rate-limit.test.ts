import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkRateLimit,
  clearRateLimitBuckets,
  getClientIpFromHeaders,
} from './rate-limit';

test('allows requests up to maxRequests then blocks with Retry-After', () => {
  clearRateLimitBuckets();
  const base = 1_700_000_000_000;
  const cfg = { windowMs: 60_000, maxRequests: 3 };

  const r1 = checkRateLimit('voice:1.2.3.4', cfg, base);
  const r2 = checkRateLimit('voice:1.2.3.4', cfg, base + 1000);
  const r3 = checkRateLimit('voice:1.2.3.4', cfg, base + 2000);
  const r4 = checkRateLimit('voice:1.2.3.4', cfg, base + 3000);

  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 2);
  assert.equal(r2.allowed, true);
  assert.equal(r3.allowed, true);
  assert.equal(r3.remaining, 0);

  assert.equal(r4.allowed, false);
  assert.equal(r4.remaining, 0);
  assert.equal(r4.retryAfterSeconds, 57);
});

test('isolates separate client keys and resets after window slides', () => {
  clearRateLimitBuckets();
  const base = 1_700_000_000_000;
  const cfg = { windowMs: 10_000, maxRequests: 1 };

  assert.equal(checkRateLimit('scan:ipA', cfg, base).allowed, true);
  assert.equal(checkRateLimit('scan:ipA', cfg, base + 500).allowed, false);
  assert.equal(checkRateLimit('scan:ipB', cfg, base + 500).allowed, true);

  // After 10s window elapses, ipA can request again
  const afterWindow = checkRateLimit('scan:ipA', cfg, base + 10_001);
  assert.equal(afterWindow.allowed, true);
});

test('extracts primary client IP from x-forwarded-for cleanly', () => {
  const headers = new Headers({
    'x-forwarded-for': '203.0.113.9, 10.0.0.1',
  });
  assert.equal(getClientIpFromHeaders(headers), '203.0.113.9');
  assert.equal(getClientIpFromHeaders(new Headers()), 'unknown-client');
});
