import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

export async function getDocsCache(
  owner: string,
  repo: string
): Promise<Record<string, unknown> | null> {
  const data = await redis.get(`docs:${owner}/${repo}:latest`);
  return data ? JSON.parse(data) : null;
}

export async function setDocsCache(
  owner: string,
  repo: string,
  data: Record<string, unknown>
): Promise<void> {
  await redis.set(`docs:${owner}/${repo}:latest`, JSON.stringify(data));
}

export async function getIndexingStatus(
  owner: string,
  repo: string
): Promise<Record<string, unknown> | null> {
  const data = await redis.get(`indexing:${owner}/${repo}:status`);
  return data ? JSON.parse(data) : null;
}

export async function setIndexingStatus(
  owner: string,
  repo: string,
  status: Record<string, unknown>
): Promise<void> {
  await redis.set(
    `indexing:${owner}/${repo}:status`,
    JSON.stringify(status),
    "EX",
    3600 // 1 hour TTL
  );
}

export async function acquireIndexingLock(
  owner: string,
  repo: string
): Promise<boolean> {
  const result = await redis.set(
    `indexing:${owner}/${repo}:lock`,
    "1",
    "EX",
    300, // 5 min TTL
    "NX"
  );
  return result === "OK";
}

export async function releaseIndexingLock(
  owner: string,
  repo: string
): Promise<void> {
  await redis.del(`indexing:${owner}/${repo}:lock`);
}

// Worker uses a separate lock key: "lock:indexing:{owner}/{repo}"
export async function clearWorkerLock(
  owner: string,
  repo: string
): Promise<void> {
  await redis.del(`lock:indexing:${owner}/${repo}`);
}

// Returns true if the worker lock was NOT held (i.e. stale / no active worker).
// If the lock exists, a worker is still running — returns false and leaves it.
export async function clearWorkerLockIfStale(
  owner: string,
  repo: string
): Promise<boolean> {
  const key = `lock:indexing:${owner}/${repo}`;
  const exists = await redis.exists(key);
  if (exists) return false;
  return true;
}

export async function clearIndexingStatus(
  owner: string,
  repo: string
): Promise<void> {
  await redis.del(`indexing:${owner}/${repo}:status`);
}

export async function clearDocsCache(
  owner: string,
  repo: string
): Promise<void> {
  await redis.del(`docs:${owner}/${repo}:latest`);
}
