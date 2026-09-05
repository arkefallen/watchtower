import { z } from "zod";

import { publicProcedure, router } from "../trpc";

const quotaSchema = z.object({ provider: z.string(), tokensAvailable: z.number(), refillPerSecond: z.number(), callsToday: z.number(), dailyLimit: z.number().nullable(), remainingToday: z.number().nullable(), rateLimitHitsToday: z.number(), windowResetsAt: z.date() });
export const healthRouter = router({
  status: publicProcedure.query(async ({ ctx }) => {
    const [db, redis, settings] = await Promise.allSettled([ctx.health.db.query(), ctx.health.redis.ping(), ctx.health.settings.loadSettings()]);
    const queues: Record<string, Record<string, number>> = {};
    for (const [name, queue] of Object.entries(ctx.health.queues)) queues[name] = await queue.getJobCounts("waiting", "active", "completed", "failed", "delayed");
    return { db: db.status === "fulfilled" ? "ok" : "down", redis: redis.status === "fulfilled" ? "ok" : "down", queues, migration: ctx.health.migration, settings: settings.status === "fulfilled" ? settings.value : null };
  }),
  quota: publicProcedure.output(z.object({ providers: z.array(quotaSchema) })).query(async ({ ctx }) => ({ providers: await ctx.health.quotas() })),
});
