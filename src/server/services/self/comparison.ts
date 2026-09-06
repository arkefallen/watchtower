// src/server/services/self/comparison.ts
import { prisma as defaultPrisma } from "@/server/db/client";
import type { PrismaClient } from "@/generated/prisma/client";
import { prismaToChainSlug } from "@/server/services/wallet/normalize";
import type { Address, ChainSlug } from "@/lib/chains/types";

export interface TradeComparisonItem {
  id: string;
  timestamp: Date;
  tokenAddress: Address;
  tokenChain: ChainSlug;
  tokenSymbol: string | null;
  side: string;
  amountUsd: string;
  followedWalletAddress: Address | null;
  followedWalletChain: ChainSlug | null;
  followedWalletLabel: string | null;
  lagMinutes: number | null;
  lagBucket: string | null;
  lagMcDelta: string | null;
  userRoiPct: string | null;
  walletRoiPct: string | null;
  roiGapPct: string | null;
  verdict: "CAPTURED" | "DECAYED" | null;
  isLinkPinned: boolean;
  thesis: string | null;
}

export interface TradeComparisonFilter {
  walletAddress?: string;
  followedWalletAddress?: string;
  tokenAddress?: string;
  sortBy?: "timestamp" | "lagMinutes" | "roiGap" | "amountUsd";
  sortOrder?: "asc" | "desc";
  limit?: number;
}

/**
 * Derives the comparison verdict:
 * - 'CAPTURED' when user ROI >= followed wallet ROI
 * - 'DECAYED'  when user ROI < followed wallet ROI
 * - null       when followed wallet ROI or user ROI is unknown/null
 */
export function deriveComparisonVerdict(
  userRoiPct: string | null,
  walletRoiPct: string | null
): "CAPTURED" | "DECAYED" | null {
  if (userRoiPct === null || walletRoiPct === null) return null;
  const user = Number(userRoiPct);
  const wallet = Number(walletRoiPct);
  if (isNaN(user) || isNaN(wallet)) return null;

  return user >= wallet ? "CAPTURED" : "DECAYED";
}

/**
 * Returns a list of linked trades with comparative ROI metrics and verdicts (FR-6.6, §4.10).
 */
export async function getTradeComparisonList(
  filter: TradeComparisonFilter = {},
  injectedPrisma: PrismaClient = defaultPrisma
): Promise<TradeComparisonItem[]> {
  const {
    walletAddress,
    followedWalletAddress,
    tokenAddress,
    sortBy = "timestamp",
    sortOrder = "desc",
    limit = 100,
  } = filter;

  const prisma = injectedPrisma;
  const where: any = {
    ownWallet: { isSelf: true },
  };

  if (walletAddress) {
    where.ownWalletAddress = walletAddress.toLowerCase();
  }

  if (followedWalletAddress) {
    where.followedWalletAddress = followedWalletAddress.toLowerCase();
  }

  if (tokenAddress) {
    where.tokenAddress = tokenAddress.toLowerCase();
  }

  const trades = await prisma.userTrade.findMany({
    where,
    include: {
      ownWallet: true,
      followedWallet: true,
      token: true,
    },
    take: limit,
  });

  const items: TradeComparisonItem[] = trades.map((t) => {
    const userRoiStr = t.roiPct ? t.roiPct.toString() : null;
    const walletRoiStr = t.walletRoiPct ? t.walletRoiPct.toString() : null;

    let roiGap: string | null = null;
    if (userRoiStr !== null && walletRoiStr !== null) {
      const u = Number(userRoiStr);
      const w = Number(walletRoiStr);
      if (!isNaN(u) && !isNaN(w)) {
        roiGap = (u - w).toFixed(2);
      }
    }

    const verdict = deriveComparisonVerdict(userRoiStr, walletRoiStr);

    return {
      id: t.id,
      timestamp: t.entryAt,
      tokenAddress: t.tokenAddress as Address,
      tokenChain: prismaToChainSlug(t.tokenChain),
      tokenSymbol: t.token?.symbol || null,
      side: t.side,
      amountUsd: t.amountUsd ? t.amountUsd.toString() : "0",
      followedWalletAddress: (t.followedWalletAddress as Address) || null,
      followedWalletChain: t.followedWalletChain ? prismaToChainSlug(t.followedWalletChain) : null,
      followedWalletLabel: t.followedWallet?.label || null,
      lagMinutes: t.lagMinutes,
      lagBucket: t.lagBucket,
      lagMcDelta: t.lagMcDelta ? t.lagMcDelta.toString() : null,
      userRoiPct: userRoiStr,
      walletRoiPct: walletRoiStr,
      roiGapPct: roiGap,
      verdict,
      isLinkPinned: t.isLinkPinned,
      thesis: t.thesis,
    };
  });

  // Client-side sorting
  items.sort((a, b) => {
    let diff = 0;
    if (sortBy === "lagMinutes") {
      const aLag = a.lagMinutes ?? (sortOrder === "asc" ? Infinity : -Infinity);
      const bLag = b.lagMinutes ?? (sortOrder === "asc" ? Infinity : -Infinity);
      diff = aLag - bLag;
    } else if (sortBy === "roiGap") {
      const aGap = a.roiGapPct ? Number(a.roiGapPct) : (sortOrder === "asc" ? Infinity : -Infinity);
      const bGap = b.roiGapPct ? Number(b.roiGapPct) : (sortOrder === "asc" ? Infinity : -Infinity);
      diff = aGap - bGap;
    } else if (sortBy === "amountUsd") {
      diff = Number(a.amountUsd) - Number(b.amountUsd);
    } else {
      diff = a.timestamp.getTime() - b.timestamp.getTime();
    }

    return sortOrder === "asc" ? diff : -diff;
  });

  return items;
}
