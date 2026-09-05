import { describe, expect, it } from "vitest";

import type { RateLimiterSnapshot } from "@/lib/ratelimit";
import { createContext } from "@/server/trpc/context";
import { healthRouter } from "@/server/trpc/routers/health";

const snapshot: RateLimiterSnapshot = {
  provider: "etherscan",
  tokensAvailable: 4,
  refillPerSecond: 4,
  callsToday: 12,
  dailyLimit: 100,
  remainingToday: 88,
  rateLimitHitsToday: 0,
  windowResetsAt: new Date("2026-01-02T00:00:00Z"),
};

function context(overrides: { db?: () => Promise<void>; redis?: () => Promise<string> } = {}) {
  return createContext({
    health: {
      db: { query: overrides.db ?? (async () => undefined) },
      redis: { ping: overrides.redis ?? (async () => "PONG") },
      queues: { intake: { getJobCounts: async () => ({ waiting: 1, active: 0, completed: 0, failed: 0, delayed: 0 }) } },
      settings: { loadSettings: async () => { throw new Error("not needed"); } },
      quotas: async () => [snapshot],
      migration: "0001_phase0_initial",
    },
    clock: { now: () => new Date("2026-01-01T00:00:00Z") },
  });
}

describe("health tRPC router", () => {
  it("reports failed DB and Redis independently", async () => {
    const caller = healthRouter.createCaller(context({ db: async () => { throw new Error("db down"); }, redis: async () => { throw new Error("redis down"); } }));
    await expect(caller.status()).resolves.toMatchObject({ db: "down", redis: "down", migration: "0001_phase0_initial" });
  });

  it("returns quota snapshots and accepts an injectable clock", async () => {
    const ctx = context();
    const caller = healthRouter.createCaller(ctx);
    await expect(caller.quota()).resolves.toEqual({ providers: [snapshot] });
    expect(ctx.clock.now().toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});
