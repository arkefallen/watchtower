import Redis from "ioredis";
import { describe, expect, it } from "vitest";

import { createTokenBucket } from "@/lib/ratelimit/token-bucket";

const redisUrl = process.env.REDIS_URL;

describe.skipIf(!redisUrl)("Redis token bucket integration", () => {
  it("enforces the configured burst and sustained refill rate", async () => {
    const redis = new Redis(redisUrl as string);
    const key = `test:ratelimit:${Date.now()}`;
    await redis.del(key);
    const bucket = createTokenBucket(redis, {
      key,
      refillPerSecond: 4,
      capacity: 5,
      maxWaitMs: 10_000,
    });
    const started = Date.now();
    await Promise.all(Array.from({ length: 20 }, () => bucket.acquire()));
    const elapsed = Date.now() - started;
    await redis.del(key);
    await redis.quit();
    expect(elapsed).toBeGreaterThanOrEqual(3_500);
  }, 15_000);
});
