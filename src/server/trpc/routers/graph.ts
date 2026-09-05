import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { prisma as dbClient } from "@/server/db/client";
import { loadGraphData } from "@/server/services/interaction/graph-query";
import { InteractionRepository } from "@/server/db/repositories/interaction-repo";
import { computeWalletVerdict } from "@/server/services/independence/verdict";

export const graphRouter = router({
  load: publicProcedure
    .input(
      z.object({
        chain: z.enum(["BASE", "BSC", "ROBINHOOD"]).optional(),
        minUsd: z.number().min(0).default(100),
        token: z.string().optional(),
        direction: z.enum(["A_TO_B", "B_TO_A", "BOTH"]).optional(),
        timeFrom: z.date().optional(),
        timeTo: z.date().optional(),
        includeFunders: z.boolean().default(false),
        includePrimaryWallets: z.boolean().default(false),
        sizeMode: z.enum(["tag", "balance"]).default("tag"),
      })
    )
    .query(async ({ ctx, input }) => {
      const prisma = ctx.prisma ?? dbClient;
      return loadGraphData(prisma, input);
    }),

  edgeBreakdown: publicProcedure
    .input(
      z.object({
        addressA: z.string(),
        chainA: z.enum(["BASE", "BSC", "ROBINHOOD"]),
        addressB: z.string(),
        chainB: z.enum(["BASE", "BSC", "ROBINHOOD"]),
      })
    )
    .query(async ({ ctx, input }) => {
      const prisma = ctx.prisma ?? dbClient;
      const repo = new InteractionRepository(prisma);
      return repo.findEdgeWithTokens(
        input.addressA,
        input.chainA,
        input.addressB,
        input.chainB
      );
    }),

  independence: publicProcedure
    .input(
      z.object({
        address: z.string(),
        chain: z.enum(["BASE", "BSC", "ROBINHOOD"]),
      })
    )
    .query(async ({ ctx, input }) => {
      const prisma = ctx.prisma ?? dbClient;
      return computeWalletVerdict(prisma, {
        address: input.address,
        chain: input.chain,
      });
    }),
});
