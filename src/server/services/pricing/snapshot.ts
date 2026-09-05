import type { PrismaClient, UsdSource, PriceConfidence } from "@/generated/prisma/client";
import type { ChainSlug, Address } from "@/lib/chains/types";
import { chainSlugToPrisma, normalizeAddress } from "../wallet/normalize";

export interface PriceSnapshotInput {
  tokenAddress: Address | string;
  chain: ChainSlug;
  timestamp: Date;
  priceUsd: string;
  marketCap?: string | null;
  liquidityUsd?: string | null;
  fdvUsd?: string | null;
  source: UsdSource;
  confidence: PriceConfidence;
  txHash?: string | null;
}

export async function persistPriceSnapshots(
  prisma: PrismaClient,
  snapshots: PriceSnapshotInput[]
): Promise<number> {
  let count = 0;
  for (const item of snapshots) {
    const prismaChain = chainSlugToPrisma(item.chain);
    const normalizedToken = normalizeAddress(item.tokenAddress);

    await prisma.priceSnapshot.upsert({
      where: {
        price_snapshot_natural_key: {
          tokenAddress: normalizedToken,
          chain: prismaChain,
          timestamp: item.timestamp,
          source: item.source,
        },
      },
      create: {
        tokenAddress: normalizedToken,
        chain: prismaChain,
        timestamp: item.timestamp,
        priceUsd: item.priceUsd,
        marketCap: item.marketCap,
        liquidityUsd: item.liquidityUsd,
        fdvUsd: item.fdvUsd,
        source: item.source,
        confidence: item.confidence,
        txHash: item.txHash,
      },
      update: {
        priceUsd: item.priceUsd,
        marketCap: item.marketCap,
        liquidityUsd: item.liquidityUsd,
        confidence: item.confidence,
      },
    });
    count++;
  }
  return count;
}
