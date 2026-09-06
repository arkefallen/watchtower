// src/server/services/self/decay.ts
import { prisma as defaultPrisma } from "@/server/db/client";
import type { PrismaClient } from "@/generated/prisma/client";
import { chainSlugToPrisma } from "@/server/services/wallet/normalize";
import type { Address, ChainSlug } from "@/lib/chains/types";
import { getLagBucket } from "./roi";

export interface EdgeDecayInput {
  followedWallet?: { address: Address | string; chain: ChainSlug };
  minSample?: number;
}

export interface EdgeDecayBucket {
  bucket: "0-1h" | "1-6h" | "6-24h" | ">24h";
  tradeCount: number;
  avgUserRoiPct: string | null;
  avgWalletRoiPct: string | null;
  winRatePct: string | null;
}

export interface EdgeDecayResult {
  followedWallet: { address: Address; chain: ChainSlug } | null;
  buckets: EdgeDecayBucket[];
  sampleSize: number;
  insufficientSample: boolean;
}

const BUCKET_ORDER: Array<"0-1h" | "1-6h" | "6-24h" | ">24h"> = [
  "0-1h",
  "1-6h",
  "6-24h",
  ">24h",
];

/**
 * Computes edge decay curve aggregating user ROI and win rate bucketed by entry lag (FR-6.4, §4.10).
 */
export async function computeEdgeDecay(
  input: EdgeDecayInput = {},
  injectedPrisma: PrismaClient = defaultPrisma
): Promise<EdgeDecayResult> {
  const { followedWallet, minSample = 5 } = input;
  const prisma = injectedPrisma;

  const where: any = {
    followedWalletAddress: { not: null },
    ownWallet: { isSelf: true },
  };

  if (followedWallet) {
    where.followedWalletAddress = followedWallet.address.toLowerCase();
    where.followedWalletChain = chainSlugToPrisma(followedWallet.chain);
  }

  const trades = await prisma.userTrade.findMany({
    where,
    orderBy: { entryAt: "asc" },
  });

  const bucketTrades: Record<
    "0-1h" | "1-6h" | "6-24h" | ">24h",
    typeof trades
  > = {
    "0-1h": [],
    "1-6h": [],
    "6-24h": [],
    ">24h": [],
  };

  for (const t of trades) {
    // Resolve bucket either from stored lagBucket or derived from lagMinutes
    const bucket = (t.lagBucket as any) || getLagBucket(t.lagMinutes);
    if (bucket && bucket in bucketTrades) {
      bucketTrades[bucket as "0-1h" | "1-6h" | "6-24h" | ">24h"].push(t);
    }
  }

  const buckets: EdgeDecayBucket[] = BUCKET_ORDER.map((bKey) => {
    const list = bucketTrades[bKey];
    if (list.length === 0) {
      return {
        bucket: bKey,
        tradeCount: 0,
        avgUserRoiPct: null,
        avgWalletRoiPct: null,
        winRatePct: null,
      };
    }

    // User ROI
    const userRois = list
      .map((t) => (t.roiPct !== null && t.roiPct !== undefined ? Number(t.roiPct) : null))
      .filter((v): v is number => v !== null && !isNaN(v));

    const avgUserRoi =
      userRois.length > 0
        ? (userRois.reduce((a, b) => a + b, 0) / userRois.length).toFixed(2)
        : null;

    // Followed Wallet ROI
    const walletRois = list
      .map((t) =>
        t.walletRoiPct !== null && t.walletRoiPct !== undefined
          ? Number(t.walletRoiPct)
          : null
      )
      .filter((v): v is number => v !== null && !isNaN(v));

    const avgWalletRoi =
      walletRois.length > 0
        ? (walletRois.reduce((a, b) => a + b, 0) / walletRois.length).toFixed(2)
        : null;

    // Win Rate (profitable trades / evaluated trades)
    const winningCount = userRois.filter((r) => r > 0).length;
    const winRate =
      userRois.length > 0
        ? ((winningCount / userRois.length) * 100).toFixed(1)
        : null;

    return {
      bucket: bKey,
      tradeCount: list.length,
      avgUserRoiPct: avgUserRoi,
      avgWalletRoiPct: avgWalletRoi,
      winRatePct: winRate,
    };
  });

  const sampleSize = trades.length;
  const insufficientSample = sampleSize < minSample;

  return {
    followedWallet: followedWallet
      ? {
          address: followedWallet.address.toLowerCase() as Address,
          chain: followedWallet.chain,
        }
      : null,
    buckets,
    sampleSize,
    insufficientSample,
  };
}
