type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitStore = Map<string, RateLimitBucket>;

type GlobalRateLimitState = typeof globalThis & {
  __lainingRateLimitStore?: RateLimitStore;
};

const globalState = globalThis as GlobalRateLimitState;
const rateLimitStore = globalState.__lainingRateLimitStore ?? new Map<string, RateLimitBucket>();

globalState.__lainingRateLimitStore = rateLimitStore;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

export function consumeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const normalizedKey = key.trim();
  if (!normalizedKey || limit <= 0 || windowMs <= 0) {
    return {
      allowed: true,
      remaining: Math.max(0, limit),
      resetAt: now,
      retryAfterSeconds: 0,
    };
  }

  const bucket = rateLimitStore.get(normalizedKey);
  if (!bucket || bucket.resetAt <= now) {
    rateLimitStore.set(normalizedKey, {
      count: 1,
      resetAt: now + windowMs,
    });

    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      resetAt: now + windowMs,
      retryAfterSeconds: 0,
    };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: bucket.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  rateLimitStore.set(normalizedKey, bucket);

  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
    retryAfterSeconds: 0,
  };
}

export function getRequestClientFingerprint(request: Request, fallback: string) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwardedFor || realIp || fallback;
}