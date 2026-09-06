// src/server/services/self/roi.ts
import type { PrismaClient } from "@/generated/prisma/client";
import { chainSlugToPrisma } from "@/server/services/wallet/normalize";
import type { Address, ChainSlug } from "@/lib/chains/types";

export interface PositionRoiResult {
  roiPct: string | null;
  costUsd: string | null;
  realizedUsd: string | null;
  entryMarketCap: string | null;
  isOpen: boolean;
}

/**
 * Computes or retrieves the ROI percentage for a given wallet and token.
 */
export async function getWalletTokenRoi(
  prisma: PrismaClient,
  walletAddress: Address | string,
  chain: ChainSlug,
  tokenAddress: Address | string
): Promise<PositionRoiResult | null> {
  const normWallet = walletAddress.toLowerCase();
  const normToken = tokenAddress.toLowerCase();
  const prismaChain = chainSlugToPrisma(chain);

  const position = await prisma.position.findFirst({
    where: {
      walletAddress: normWallet,
      walletChain: prismaChain,
      tokenAddress: normToken,
      tokenChain: prismaChain,
    },
  });

  if (!position) {
    return null;
  }

  const cost = Number(position.costUsd || 0);
  const realized = Number(position.realizedUsd || 0);
  const unrealized = Number(position.unrealizedUsd || 0);
  const entryMc = position.entryMarketCap ? position.entryMarketCap.toString() : null;

  if (cost <= 0) {
    return {
      roiPct: null,
      costUsd: cost.toString(),
      realizedUsd: realized.toString(),
      entryMarketCap: entryMc,
      isOpen: position.isOpen,
    };
  }

  // If closed, ROI is based entirely on realized / cost
  // If open, ROI includes unrealized
  const totalReturnUsd = position.isOpen ? realized + unrealized : realized;
  const roiValue = ((totalReturnUsd - cost) / cost) * 100;

  return {
    roiPct: roiValue.toFixed(2),
    costUsd: cost.toString(),
    realizedUsd: realized.toString(),
    entryMarketCap: entryMc,
    isOpen: position.isOpen,
  };
}

/**
 * Formats lagMinutes into the canonical FR-6.4 lag buckets:
 * - '0-1h'  : [0, 60) minutes
 * - '1-6h'  : [60, 360) minutes
 * - '6-24h' : [360, 1440) minutes
 * - '>24h'  : >= 1440 minutes
 */
export function getLagBucket(lagMinutes: number | null): "0-1h" | "1-6h" | "6-24h" | ">24h" | null {
  if (lagMinutes === null || lagMinutes < 0) return null;
  if (lagMinutes < 60) return "0-1h";
  if (lagMinutes < 360) return "1-6h";
  if (lagMinutes < 1440) return "6-24h";
  return ">24h";
}
