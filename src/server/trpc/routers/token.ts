// src/server/trpc/routers/token.ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { prisma as dbClient } from "@/server/db/client";
import { checkAndPersistTokenRedFlags } from "@/server/services/token/red-flags";

const chainSchema = z.enum(["base", "bsc", "robinhood"]);

export const tokenRouter = router({
  redFlags: publicProcedure
    .input(
      z.object({
        address: z.string().min(1),
        chain: chainSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      return checkAndPersistTokenRedFlags(
        {
          tokenAddress: input.address,
          chain: input.chain,
        },
        ctx.prisma ?? dbClient
      );
    }),

  lookup: publicProcedure
    .input(
      z.object({
        address: z.string().min(1),
        chain: chainSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const { lookupTokenDetails } = await import("@/server/services/token/lookup");
      return lookupTokenDetails(
        {
          tokenAddress: input.address,
          chain: input.chain,
        },
        ctx.prisma ?? dbClient
      );
    }),

  refresh: publicProcedure
    .input(
      z.object({
        address: z.string().min(1),
        chain: chainSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const normAddress = input.address.toLowerCase();
      const jobId = `token:refresh:${input.chain}:${normAddress}:${Date.now()}`;
      const prisma = ctx.prisma ?? dbClient;

      // If queue is configured, enqueue non-blocking job
      if (ctx.queues?.pricing) {
        await ctx.queues.pricing.add(
          "tokenRefresh",
          {
            tokenAddress: normAddress,
            chain: input.chain,
          },
          { jobId }
        );
      }

      if (prisma) {
        await prisma.jobRun.create({
          data: {
            id: jobId,
            queueName: "watchtower.pricing",
            jobName: "tokenRefresh",
            payloadJson: {
              tokenAddress: normAddress,
              chain: input.chain,
            },
            status: "QUEUED",
          },
        }).catch(() => null);
      }

      return {
        jobId,
        status: "QUEUED",
        tokenAddress: normAddress,
        chain: input.chain,
        message: "Token metadata refresh enqueued",
      };
    }),
});

