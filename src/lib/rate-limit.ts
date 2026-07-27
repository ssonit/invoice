import "server-only"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import {
  UPLOAD_RATE_LIMIT_MAX_REQUESTS,
  UPLOAD_RATE_LIMIT_WINDOW_SECONDS,
} from "@/constants/rate-limit"

// Not configured (e.g. local dev without an Upstash account) → rate limiting
// no-ops rather than blocking uploads, same as before this feature existed.
const uploadRatelimit =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(
          UPLOAD_RATE_LIMIT_MAX_REQUESTS,
          `${UPLOAD_RATE_LIMIT_WINDOW_SECONDS} s`,
        ),
        prefix: "ratelimit:upload",
      })
    : null;

export type RateLimitCheck = { limited: false } | { limited: true; retryAfterSeconds: number }

export async function checkUploadRateLimit(userId: string): Promise<RateLimitCheck> {
  if (!uploadRatelimit) return { limited: false }

  const { success, reset } = await uploadRatelimit.limit(userId)
  if (success) return { limited: false }

  return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil((reset - Date.now()) / 1000)) }
}
