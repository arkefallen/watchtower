import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { prisma as dbClient } from "@/server/db/client";

export const clusterRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const prisma = ctx.prisma ?? dbClient;
    return prisma.cluster.findMany({
      include: {
        members: true,
      },
      orderBy: {
        combinedStableUsd: "desc",
      },
    });
  }),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const prisma = ctx.prisma ?? dbClient;
      return prisma.cluster.findUnique({
        where: { id: input.id },
        include: {
          members: {
            include: {
              wallet: {
                include: {
                  profile: true,
                },
              },
            },
          },
        },
      });
    }),
});
