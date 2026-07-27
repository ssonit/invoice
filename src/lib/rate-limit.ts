import "server-only"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import {
  UPLOAD_RATE_LIMIT_MAX_REQUESTS,
  UPLOAD_RATE_LIMIT_WINDOW_SECONDS,
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  LOGIN_RATE_LIMIT_WINDOW_SECONDS,
  SIGNUP_RATE_LIMIT_MAX_ATTEMPTS,
  SIGNUP_RATE_LIMIT_WINDOW_SECONDS,
  FORGOT_PASSWORD_RATE_LIMIT_MAX_ATTEMPTS,
  FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS,
} from "@/constants/rate-limit"

// Not configured (e.g. local dev without an Upstash account) → every limiter
// below no-ops rather than blocking requests, same as before this existed.
const isConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);

function makeLimiter(prefix: string, maxRequests: number, windowSeconds: number) {
  if (!isConfigured) return null
  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
    prefix: `ratelimit:${prefix}`,
  })
}

const uploadRatelimit = makeLimiter(
  "upload",
  UPLOAD_RATE_LIMIT_MAX_REQUESTS,
  UPLOAD_RATE_LIMIT_WINDOW_SECONDS,
)
const loginRatelimit = makeLimiter(
  "login",
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  LOGIN_RATE_LIMIT_WINDOW_SECONDS,
)
const signupRatelimit = makeLimiter(
  "signup",
  SIGNUP_RATE_LIMIT_MAX_ATTEMPTS,
  SIGNUP_RATE_LIMIT_WINDOW_SECONDS,
)
const forgotPasswordRatelimit = makeLimiter(
  "forgot-password",
  FORGOT_PASSWORD_RATE_LIMIT_MAX_ATTEMPTS,
  FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS,
)

export type RateLimitCheck = { limited: false } | { limited: true; retryAfterSeconds: number }

async function check(limiter: Ratelimit | null, key: string): Promise<RateLimitCheck> {
  if (!limiter) return { limited: false }

  const { success, reset } = await limiter.limit(key)
  if (success) return { limited: false }

  return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil((reset - Date.now()) / 1000)) }
}

export function checkUploadRateLimit(userId: string): Promise<RateLimitCheck> {
  return check(uploadRatelimit, userId)
}

/** Keyed by the submitted email — bounds brute-force login attempts against one account. */
export function checkLoginRateLimit(email: string): Promise<RateLimitCheck> {
  return check(loginRatelimit, email.toLowerCase())
}

/** Keyed by the submitted email — bounds signup spam. */
export function checkSignupRateLimit(email: string): Promise<RateLimitCheck> {
  return check(signupRatelimit, email.toLowerCase())
}

/** Keyed by the submitted email — bounds password-reset email spam. */
export function checkForgotPasswordRateLimit(email: string): Promise<RateLimitCheck> {
  return check(forgotPasswordRatelimit, email.toLowerCase())
}
