import type { PrismaClient } from "@/generated/prisma/client";
import type { ChainSlug } from "@/lib/chains/types";
import type { PriceConfidence } from "./attribute";
import { chainSlugToPrisma } from "../wallet/normalize";

export function createNativePriceStore(prisma: PrismaClient) {
  return {
    async nearest(
      chain: ChainSlug,
      at: Date,
      maxSkewMs: number = 86400000 // 24 hours
    ): Promise<{ priceUsd: string; confidence: PriceConfidence } | null> {
      const prismaChain = chainSlugToPrisma(chain);

      // Find nearest snapshot before or at `at`
      const before = await prisma.nativePriceSnapshot.findFirst({
        where: {
          chain: prismaChain,
          timestamp: { lte: at },
        },
        orderBy: { timestamp: "desc" },
      });

      // Find nearest snapshot after `at`
      const after = await prisma.nativePriceSnapshot.findFirst({
        where: {
          chain: prismaChain,
          timestamp: { gte: at },
        },
        orderBy: { timestamp: "asc" },
      });

      let chosen = before;
      if (!chosen || (after && Math.abs(after.timestamp.getTime() - at.getTime()) < Math.abs(chosen.timestamp.getTime() - at.getTime()))) {
        chosen = after;
      }

      if (!chosen) return null;

      const skew = Math.abs(chosen.timestamp.getTime() - at.getTime());
      if (skew > maxSkewMs) return null;

      const confidence: PriceConfidence =
        skew <= 300000 ? "HIGH" : skew <= 3600000 ? "MEDIUM" : "LOW";

      return {
        priceUsd: String(chosen.priceUsd),
        confidence,
      };
    },

    async record(
      chain: ChainSlug,
      at: Date,
      priceUsd: string,
      source: "SWAP_LEG_STABLE" | "DEXSCREENER" | "COINGECKO" = "DEXSCREENER",
      confidence: PriceConfidence = "HIGH"
    ) {
      const prismaChain = chainSlugToPrisma(chain);
      return prisma.nativePriceSnapshot.upsert({
        where: {
          chain_timestamp_source: {
            chain: prismaChain,
            timestamp: at,
            source: source as any,
          },
        },
        create: {
          chain: prismaChain,
          timestamp: at,
          priceUsd,
          source: source as any,
          confidence,
        },
        update: {
          priceUsd,
          confidence,
        },
      });
    },
  };
}
