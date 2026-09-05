import type { Prisma, PrismaClient, Chain } from "@/generated/prisma/client";

export interface InteractionEdgeFilter {
  minUsd?: number;
  token?: string;
  direction?: "A_TO_B" | "B_TO_A" | "BOTH";
  timeFrom?: Date;
  timeTo?: Date;
  chain?: Chain;
}

export class InteractionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Find interaction edges matching filters.
   */
  async findEdges(filter: InteractionEdgeFilter = {}) {
    const where: Prisma.InteractionEdgeWhereInput = {};

    if (filter.chain) {
      where.chainA = filter.chain;
      where.chainB = filter.chain;
    }

    if (filter.minUsd !== undefined && filter.minUsd > 0) {
      where.totalUsd = { gte: filter.minUsd };
    }

    if (filter.timeFrom || filter.timeTo) {
      where.lastAt = {};
      if (filter.timeFrom) {
        where.lastAt.gte = filter.timeFrom;
      }
      if (filter.timeTo) {
        where.lastAt.lte = filter.timeTo;
      }
    }

    if (filter.token) {
      where.tokens = {
        some: {
          OR: [
            { tokenAddress: filter.token.toLowerCase() },
            { tokenSymbol: { equals: filter.token, mode: "insensitive" } },
          ],
        },
      };
    }

    if (filter.direction === "A_TO_B") {
      where.countAToB = { gt: 0 };
    } else if (filter.direction === "B_TO_A") {
      where.countBToA = { gt: 0 };
    }

    return this.prisma.interactionEdge.findMany({
      where,
      include: {
        tokens: true,
      },
      orderBy: { totalUsd: "desc" },
    });
  }

  /**
   * Find a single edge with all its token breakdowns.
   */
  async findEdgeWithTokens(addressA: string, chainA: Chain, addressB: string, chainB: Chain) {
    return this.prisma.interactionEdge.findUnique({
      where: {
        interaction_edge_key: {
          addressA: addressA.toLowerCase(),
          chainA,
          addressB: addressB.toLowerCase(),
          chainB,
        },
      },
      include: {
        tokens: {
          orderBy: { totalUsd: "desc" },
        },
      },
    });
  }

  /**
   * Delete edges for a wallet or rebuild scope.
   */
  async deleteEdges(scope: { address?: string; chain?: Chain }) {
    const where: Prisma.InteractionEdgeWhereInput = {};
    if (scope.chain) {
      where.chainA = scope.chain;
      where.chainB = scope.chain;
    }
    if (scope.address) {
      const addr = scope.address.toLowerCase();
      where.OR = [
        { addressA: addr },
        { addressB: addr },
      ];
    }
    return this.prisma.interactionEdge.deleteMany({ where });
  }
}
