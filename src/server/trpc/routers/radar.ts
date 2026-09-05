// src/server/trpc/routers/radar.ts
import { router, publicProcedure } from "@/server/trpc/trpc";
import { z } from "zod";
import { movementService } from "@/server/services/movement/movementService";

export const radarRouter = router({
  // Feed: paginated movement events
  feed: publicProcedure
    .input(
      z.object({
        walletAddress: z.string().optional(),
        chain: z.enum(["BASE", "BSC", "ROBINHOOD"]).optional(),
        timeWindowHours: z.number().min(1).max(720).default(24),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        search: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      return movementService.getFeed(input);
    }),

  // Group: aggregated movement groups
  group: publicProcedure
    .input(
      z.object({
        timeWindowHours: z.number().min(1).max(720).default(24),
        kind: z.enum(["CO_ACCUMULATION", "CO_DISTRIBUTION", "CLUSTER_CO_ENTRY"]).optional(),
      })
    )
    .query(async ({ input }) => {
      return movementService.getGroups(input);
    }),

  // Evaluate: trigger recomputation job (fire‑and‑forget)
  evaluate: publicProcedure
    .input(z.object({ timeWindowHours: z.number().min(1).max(720).default(24) }))
    .mutation(async ({ ctx, input }) => {
      // enqueue a BullMQ job; the queue is defined in workers/queues.ts as "radar.evaluate"
      const job = await ctx.queues.radar.evaluate.add("evaluate", { timeWindowHours: input.timeWindowHours });
      return { jobId: job.id };
    }),
});
