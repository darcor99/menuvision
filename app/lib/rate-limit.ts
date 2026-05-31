interface Entry {
  count: number;
  resetAt: number; // epoch ms
}

// Shared across all routes in the same server process.
// Keyed as "<route>:<ip>" so each route has its own independent limit.
const store = new Map<string, Entry>();

function pruneExpired(now: number) {
  // Amortise the scan cost — only run when the store grows large.
  if (store.size < 1_000) return;
  store.forEach((entry, key) => {
    if (now > entry.resetAt) store.delete(key);
  });
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

/**
 * Fixed-window rate limiter.
 * @param ip      Client IP address.
 * @param route   Short route identifier, e.g. "ocr".
 * @param limit   Max requests per window (default 10).
 * @param windowMs Window size in ms (default 60 000 = 1 minute).
 */
export function checkRateLimit(
  ip: string,
  route: string,
  limit = 10,
  windowMs = 60_000
): RateLimitResult {
  const now = Date.now();
  pruneExpired(now);

  const key = `${route}:${ip}`;
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetInMs: windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetInMs: entry.resetAt - now };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetInMs: entry.resetAt - now,
  };
}

/** Extract the real client IP from Vercel / standard proxy headers. */
export function getIp(request: Request): string {
  const forwarded = (request.headers as Headers).get("x-forwarded-for");
  return forwarded?.split(",")[0].trim() || "unknown";
}
