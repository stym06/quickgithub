import { redis } from "./redis";
import { MAX_CHAT_QUESTIONS } from "./constants";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export async function slidingWindowRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - windowMs;
  const fullKey = `ratelimit:${key}`;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(fullKey, "-inf", windowStart);
  pipeline.zadd(fullKey, now, `${now}:${Math.random()}`);
  pipeline.zcard(fullKey);
  pipeline.pexpire(fullKey, windowMs);

  const results = await pipeline.exec();
  const count = (results?.[2]?.[1] as number) || 0;

  return {
    allowed: count <= maxRequests,
    remaining: Math.max(0, maxRequests - count),
  };
}

export async function checkChatLimit(
  sessionToken: string
): Promise<RateLimitResult> {
  const key = `chat:${sessionToken}`;
  const count = await redis.get(key);
  const used = count ? parseInt(count, 10) : 0;

  return {
    allowed: used < MAX_CHAT_QUESTIONS,
    remaining: Math.max(0, MAX_CHAT_QUESTIONS - used),
  };
}

export async function incrementChatCount(
  sessionToken: string
): Promise<void> {
  const key = `chat:${sessionToken}`;
  await redis.incr(key);
}

export async function checkIPLimit(ip: string): Promise<RateLimitResult> {
  return slidingWindowRateLimit(`ip:${ip}`, 100, 60000); // 100 req/min
}
