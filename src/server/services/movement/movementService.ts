// src/server/services/movement/movementService.ts
import { prisma } from "@/server/db/client";
import { z } from "zod";
// Enums imported from Prisma client are not used in this service

/** Input schema for the feed endpoint */
export const FeedInput = z.object({
  walletAddress: z.string().optional(),
  chain: z.enum(["BASE", "BSC", "ROBINHOOD"]).optional(),
  timeWindowHours: z.number().min(1).max(720).default(24),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  search: z.string().optional(),
});

/** Input schema for the group endpoint */
export const GroupInput = z.object({
  timeWindowHours: z.number().min(1).max(720).default(24),
  kind: z.enum(["CO_ACCUMULATION", "CO_DISTRIBUTION", "CLUSTER_CO_ENTRY"]).optional(),
});

/** Service exposing radar data */
export const movementService = {
  /** Paginated movement feed */
  async getFeed(params: z.infer<typeof FeedInput>) {
    const { walletAddress, chain, timeWindowHours, cursor, limit, search } = params;
    const since = new Date();
    since.setUTCHours(since.getUTCHours() - timeWindowHours);
    const where: any = { timestamp: { gte: since } };
    if (walletAddress) where.walletAddress = walletAddress;
    if (chain) where.chain = chain;
    if (search) {
      where.OR = [
        { fromAddress: { contains: search, mode: "insensitive" } },
        { toAddress: { contains: search, mode: "insensitive" } },
      ];
    }
    const records = await prisma.movementEvent.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: limit,
      cursor: cursor ? { id: BigInt(cursor) } : undefined,
      skip: cursor ? 1 : 0,
      include: {
        transaction: {
          select: {
            fromAddress: true,
            toAddress: true,
            chain: true,
            blockNumber: true,
          },
        },
      },
    });
    const nextCursor = records.length === limit ? records[records.length - 1].id.toString() : undefined;
    return { data: records, nextCursor };
  },

  /** Aggregated movement groups */
  async getGroups(params: z.infer<typeof GroupInput>) {
    const { timeWindowHours, kind } = params;
    const since = new Date();
    since.setUTCHours(since.getUTCHours() - timeWindowHours);
    const where: any = { timestamp: { gte: since } };
    if (kind) where.kind = kind;
    const groups = await prisma.movementGroup.findMany({
      where,
      include: { members: true },
      orderBy: { createdAt: "desc" },
    });
    return groups;
  },
};
