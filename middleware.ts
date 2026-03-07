import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// In-memory rate limit store — works for single-instance deployment (Vercel).
// Map of "ip:route" -> { count, resetAt }
const rateLimitStore = new Map<
  string,
  { count: number; resetAt: number }
>();

// Cleanup old entries periodically
let lastCleanup = Date.now();
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return; // Only cleanup every minute
  lastCleanup = now;
  rateLimitStore.forEach((value, key) => {
    if (now > value.resetAt) {
      rateLimitStore.delete(key);
    }
  });
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

// Rate limit rules per route pattern
const rateLimitRules: { pattern: RegExp; config: RateLimitConfig }[] = [
  {
    // PIN lookup: 5 requests/minute per IP
    pattern: /^\/api\/attendees\/by-pin\//,
    config: { maxRequests: 5, windowMs: 60_000 },
  },
  {
    // Photo upload: 10 uploads/minute per IP
    pattern: /^\/api\/photos\/upload/,
    config: { maxRequests: 10, windowMs: 60_000 },
  },
  {
    // CSV import: 1 request/minute per IP
    pattern: /^\/api\/attendees\/import/,
    config: { maxRequests: 1, windowMs: 60_000 },
  },
  {
    // General API: 60 requests/minute per IP
    pattern: /^\/api\//,
    config: { maxRequests: 60, windowMs: 60_000 },
  },
];

function getRateLimitConfig(
  pathname: string
): RateLimitConfig | null {
  for (const rule of rateLimitRules) {
    if (rule.pattern.test(pathname)) {
      return rule.config;
    }
  }
  return null;
}

function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  cleanup();
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    const resetAt = now + config.windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt };
  }

  entry.count++;
  if (entry.count > config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const config = getRateLimitConfig(pathname);

  if (!config) {
    return NextResponse.next();
  }

  // Use x-forwarded-for for real IP on Vercel, fallback to x-real-ip
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  // More specific routes get their own bucket
  const matchedPattern = rateLimitRules.find((r) =>
    r.pattern.test(pathname)
  );
  const bucketKey = matchedPattern
    ? `${ip}:${matchedPattern.pattern.source}`
    : `${ip}:general`;

  const result = checkRateLimit(bucketKey, config);

  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.ceil((result.resetAt - Date.now()) / 1000)
          ),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const response = NextResponse.next();
  response.headers.set(
    "X-RateLimit-Remaining",
    String(result.remaining)
  );
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
