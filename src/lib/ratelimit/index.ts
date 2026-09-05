import type { RateLimiterSnapshot } from "./types";
import type { CallPriority } from "./budget";
import { createBudgetGuard, type DailyBudgetConfig, type DailyCounter } from "./budget";
import { createTokenBucket, type RedisEvalClient, type TokenBucketConfig } from "./token-bucket";
import type { UsageDelegate } from "./usage";
import { createUsageRecorder } from "./usage";

export type { CallPriority, DailyBudgetConfig } from "./budget";
export { DailyBudgetExceededError } from "./budget";
export { RateLimitTimeoutError } from "./token-bucket";
export type { RateLimiterSnapshot } from "./types";

export interface RateLimiter {
  acquire(cost: number, priority: CallPriority): Promise<void>;
  budgetRemaining(): Promise<{ dayCalls: number; dayLimit: number; remaining: number }>;
  snapshot(): Promise<RateLimiterSnapshot>;
}

export interface RateLimiterDependencies {
  redis: RedisEvalClient & {
    get: (key: string) => Promise<string | null>;
    incrby: (key: string, amount: number) => Promise<number>;
    expire: (key: string, seconds: number) => Promise<number>;
  };
  bucket: TokenBucketConfig;
  budget: DailyBudgetConfig;
  usage: UsageDelegate;
  rateLimitHits: () => Promise<number>;
}

function dayKey(provider: string): string {
  return `usage:${provider}:${new Date().toISOString().slice(0, 10)}`;
}

function nextUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

export function createRateLimiter(deps: RateLimiterDependencies): RateLimiter & { record: (outcome: "ok" | "error" | "rate_limited", records: number) => Promise<void>; brake: () => Promise<void> } {
  const counter: DailyCounter = {
    get: async () => Number(await deps.redis.get(dayKey(deps.budget.provider)) ?? 0),
    increment: async (amount) => {
      const value = await deps.redis.incrby(dayKey(deps.budget.provider), amount);
      await deps.redis.expire(dayKey(deps.budget.provider), 172_800);
      return value;
    },
  };
  const bucket = createTokenBucket(deps.redis, deps.bucket);
  const guard = createBudgetGuard(deps.budget, counter);
  const usage = createUsageRecorder(deps.usage);
  return {
    async acquire(cost, priority) {
      await guard.acquire(cost, priority);
      await bucket.acquire(cost);
      await guard.record(cost);
    },
    budgetRemaining: guard.remaining,
    async snapshot() {
      const remaining = await guard.remaining();
      return {
        provider: deps.budget.provider,
        tokensAvailable: 0,
        refillPerSecond: deps.bucket.refillPerSecond,
        callsToday: remaining.dayCalls,
        dailyLimit: remaining.dayLimit,
        remainingToday: remaining.remaining,
        rateLimitHitsToday: await deps.rateLimitHits(),
        windowResetsAt: nextUtcMidnight(),
      };
    },
    record: (outcome, records) => usage.record(deps.budget.provider, outcome, records),
    brake: () => bucket.brake(),
  };
}
