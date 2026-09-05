import { describe, expect, it } from "vitest";

import { createBudgetGuard, DailyBudgetExceededError } from "@/lib/ratelimit/budget";
import { createUsageRecorder } from "@/lib/ratelimit/usage";
import { createTokenBucket, RateLimitTimeoutError } from "@/lib/ratelimit/token-bucket";

describe("rate limiting", () => {
  it("keeps the interactive reserve for background calls", async () => {
    let calls = 90;
    const guard = createBudgetGuard({ provider: "etherscan", dailyLimit: 100, reservedForInteractivePct: 10 }, {
      get: async () => calls,
      increment: async (amount) => (calls += amount),
    });
    await expect(guard.acquire(1, "BACKGROUND")).rejects.toBeInstanceOf(DailyBudgetExceededError);
    await expect(guard.acquire(1, "INTERACTIVE")).resolves.toBeUndefined();
  });

  it("allows interactive calls only until the hard daily limit", async () => {
    let calls = 99;
    const guard = createBudgetGuard({ provider: "etherscan", dailyLimit: 100, reservedForInteractivePct: 10 }, {
      get: async () => calls,
      increment: async (amount) => (calls += amount),
    });
    await expect(guard.acquire(1, "INTERACTIVE")).resolves.toBeUndefined();
    calls = 100;
    await expect(guard.acquire(1, "INTERACTIVE")).rejects.toBeInstanceOf(DailyBudgetExceededError);
  });

  it("records ok, error, and rate-limited outcomes separately", async () => {
    const updates: unknown[] = [];
    const recorder = createUsageRecorder({
      upsert: async (args) => { updates.push(args); },
    });
    await recorder.record("etherscan", "ok", 3);
    await recorder.record("etherscan", "error", 0);
    await recorder.record("etherscan", "rate_limited", 0);
    expect(updates).toHaveLength(3);
    expect((updates[1] as { create: { errorCount: number } }).create.errorCount).toBe(1);
    expect((updates[2] as { create: { rateLimitHits: number } }).create.rateLimitHits).toBe(1);
  });

  it("times out when the Redis bucket cannot grant a token", async () => {
    const redis = {
      eval: async () => 100,
    };
    const bucket = createTokenBucket(redis, { key: "test", refillPerSecond: 1, capacity: 1, maxWaitMs: 5 });
    await expect(bucket.acquire()).rejects.toBeInstanceOf(RateLimitTimeoutError);
  });
});
