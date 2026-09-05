export interface TokenBucketConfig {
  key: string;
  refillPerSecond: number;
  capacity: number;
  maxWaitMs: number;
}

export interface RedisEvalClient {
  eval: (script: string, numKeys: number, ...args: Array<string | number>) => Promise<unknown>;
}

export class RateLimitTimeoutError extends Error {
  constructor(message = "Rate-limit token acquisition timed out") {
    super(message);
    this.name = "RateLimitTimeoutError";
  }
}

export const TOKEN_BUCKET_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local cost = tonumber(ARGV[2])
local refill = tonumber(ARGV[3])
local capacity = tonumber(ARGV[4])
local brake = tonumber(redis.call('HGET', key, 'brakeUntil') or '0')
if brake > now then refill = refill / 2 else redis.call('HDEL', key, 'brakeUntil') end
local tokens = tonumber(redis.call('HGET', key, 'tokens') or capacity)
local timestamp = tonumber(redis.call('HGET', key, 'timestamp') or now)
tokens = math.min(capacity, tokens + math.max(0, now - timestamp) / 1000 * refill)
if tokens >= cost then
  tokens = tokens - cost
  redis.call('HSET', key, 'tokens', tokens, 'timestamp', now)
  return 0
end
redis.call('HSET', key, 'tokens', tokens, 'timestamp', now)
return math.ceil((cost - tokens) / refill * 1000)
`;

export function createTokenBucket(redis: RedisEvalClient, config: TokenBucketConfig) {
  return {
    async acquire(cost = 1): Promise<void> {
      if (!Number.isFinite(cost) || cost <= 0) throw new Error("Token cost must be positive");
      const startedAt = Date.now();
      while (true) {
        const result = Number(await redis.eval(
          TOKEN_BUCKET_LUA,
          1,
          config.key,
          Date.now(),
          cost,
          config.refillPerSecond,
          config.capacity,
        ));
        if (result <= 0) return;
        const elapsed = Date.now() - startedAt;
        if (elapsed + result > config.maxWaitMs) throw new RateLimitTimeoutError();
        await new Promise<void>((resolve) => setTimeout(resolve, Math.min(result, config.maxWaitMs - elapsed)));
      }
    },
    async brake(durationMs = 60_000): Promise<void> {
      await redis.eval(
        "redis.call('HSET', KEYS[1], 'brakeUntil', tonumber(ARGV[1])); return 1",
        1,
        config.key,
        Date.now() + durationMs,
      );
    },
  };
}
