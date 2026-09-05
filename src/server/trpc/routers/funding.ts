import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { prisma as dbClient } from "@/server/db/client";
import type { Address, ChainSlug } from "@/lib/chains/types";
import { loadFundingTree } from "@/server/services/funding/trace";
import { processFundingTraceJob } from "@/server/workers/processors/funding-trace";
import type { Job } from "bullmq";

const chainSchema = z.enum(["base", "bsc", "robinhood"]);

export const fundingRouter = router({
  tree: publicProcedure
    .input(
      z.object({
        address: z.string().min(1),
        chain: chainSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const prisma = ctx.prisma ?? dbClient;
      return loadFundingTree(
        input.address.toLowerCase() as Address,
        input.chain as ChainSlug,
        prisma
      );
    }),

  deepTrace: publicProcedure
    .input(
      z.object({
        address: z.string().min(1),
        chain: chainSchema,
        branchAddress: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const prisma = ctx.prisma ?? dbClient;
      const fakeJob = {
        data: {
          walletAddress: input.address,
          chain: input.chain as ChainSlug,
          mode: "DEEP" as const,
          branchAddress: input.branchAddress,
        },
        updateProgress: async () => {},
      } as unknown as Job;

      await processFundingTraceJob(fakeJob, prisma);

      return loadFundingTree(
        input.address.toLowerCase() as Address,
        input.chain as ChainSlug,
        prisma
      );
    }),
});
