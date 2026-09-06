// src/server/services/self/dashboard.ts
import { prisma as defaultPrisma } from "@/server/db/client";
import type { PrismaClient } from "@/generated/prisma/client";
import { prismaToChainSlug } from "@/server/services/wallet/normalize";
import type { Address, ChainSlug } from "@/lib/chains/types";
import { computeEdgeDecay, type EdgeDecayBucket } from "./decay";

export interface SelfDashboardInput {
  walletAddress?: string;
  asOf?: Date;
}

export interface FollowedWalletPnlSummary {
  address: Address;
  chain: ChainSlug;
  label: string | null;
  tradeCount: number;
  pnlUsd: string;
  avgLagMinutes: number | null;
}

export interface TokenPnlSummary {
  tokenAddress: Address;
  chain: ChainSlug;
  symbol: string | null;
  tradeCount: number;
  pnlUsd: string;
}

export interface SelfDashboardResult {
  winRatePct: string;
  totalPnlUsd: string;
  unrealizedPnlUsd: string;
  avgFollowLagMinutes: number | null;
  totalTradesCount: number;
  linkedTradesCount: number;
  byFollowedWallet: FollowedWalletPnlSummary[];
  byToken: TokenPnlSummary[];
  byLagBucket: EdgeDecayBucket[];
}

/**
 * Computes comprehensive performance dashboard for self-registered wallets (FR-6.5, §4.10).
 */
export async function computeSelfDashboard(
  input: SelfDashboardInput = {},
  injectedPrisma: PrismaClient = defaultPrisma
): Promise<SelfDashboardResult> {
  const { walletAddress } = input;
  const prisma = injectedPrisma;

  const where: any = {
    ownWallet: { isSelf: true },
  };

  if (walletAddress) {
    where.ownWalletAddress = walletAddress.toLowerCase();
  }

  // 1. Fetch user trades and user positions
  const trades = await prisma.userTrade.findMany({
    where,
    include: {
      ownWallet: true,
      followedWallet: true,
      token: true,
    },
    orderBy: { entryAt: "asc" },
  });

  const positions = await prisma.position.findMany({
    where: {
      wallet: { isSelf: true },
      ...(walletAddress ? { walletAddress: walletAddress.toLowerCase() } : {}),
    },
    include: {
      token: true,
    },
  });

  if (trades.length === 0 && positions.length === 0) {
    const emptyDecay = await computeEdgeDecay({}, prisma);
    return {
      winRatePct: "0.0",
      totalPnlUsd: "0.00",
      unrealizedPnlUsd: "0.00",
      avgFollowLagMinutes: null,
      totalTradesCount: 0,
      linkedTradesCount: 0,
      byFollowedWallet: [],
      byToken: [],
      byLagBucket: emptyDecay.buckets,
    };
  }

  // 2. Realized vs Unrealized PnL
  // Open positions are excluded from realized PnL (DoD)
  let totalRealizedPnl = 0;
  let totalUnrealizedPnl = 0;

  // Track PnL per token from positions
  const tokenPnlMap = new Map<
    string,
    { tokenAddress: Address; chain: ChainSlug; symbol: string | null; pnl: number; count: number }
  >();

  for (const pos of positions) {
    const cost = Number(pos.costUsd || 0);
    const realized = Number(pos.realizedUsd || 0);
    const unrealized = Number(pos.unrealizedUsd || 0);

    if (!pos.isOpen) {
      // Closed position contributes to realized PnL
      totalRealizedPnl += realized - cost;
    } else {
      // Open position contributes to unrealized PnL
      totalUnrealizedPnl += unrealized;
    }

    const tKey = `${pos.tokenAddress.toLowerCase()}_${pos.tokenChain}`;
    const existing = tokenPnlMap.get(tKey) ?? {
      tokenAddress: pos.tokenAddress.toLowerCase() as Address,
      chain: prismaToChainSlug(pos.tokenChain),
      symbol: pos.token?.symbol || null,
      pnl: 0,
      count: 0,
    };

    if (!pos.isOpen) {
      existing.pnl += realized - cost;
    }
    tokenPnlMap.set(tKey, existing);
  }

  // Also calculate PnL directly from user trades if no positions exist for them
  let closedTradesCount = 0;
  let winningTradesCount = 0;
  let totalLagMinutes = 0;
  let lagCount = 0;

  const followedWalletMap = new Map<
    string,
    {
      address: Address;
      chain: ChainSlug;
      label: string | null;
      tradeCount: number;
      pnl: number;
      totalLag: number;
      lagCount: number;
    }
  >();

  let linkedTradesCount = 0;

  for (const t of trades) {
    if (t.followedWalletAddress) {
      linkedTradesCount++;
    }

    // Trade is closed if exitAt is set or roiPct is set
    const isClosed = Boolean(t.exitAt || (t.roiPct !== null && t.roiPct !== undefined));
    let tradePnl = 0;

    if (isClosed) {
      closedTradesCount++;
      if (t.roiPct !== null && t.roiPct !== undefined) {
        const roi = Number(t.roiPct);
        const amount = Number(t.amountUsd || 0);
        tradePnl = amount * (roi / 100);
        if (roi > 0) {
          winningTradesCount++;
        }
      }
    }

    // If positions were not populated, fallback to trade-level sum
    if (positions.length === 0 && isClosed) {
      totalRealizedPnl += tradePnl;
    }

    // Followed wallet aggregation
    if (t.followedWalletAddress) {
      const fAddr = t.followedWalletAddress.toLowerCase() as Address;
      const fChain = prismaToChainSlug(t.followedWalletChain!);
      const fKey = `${fAddr}_${fChain}`;

      const fw = followedWalletMap.get(fKey) ?? {
        address: fAddr,
        chain: fChain,
        label: t.followedWallet?.label || null,
        tradeCount: 0,
        pnl: 0,
        totalLag: 0,
        lagCount: 0,
      };

      fw.tradeCount++;
      if (isClosed) {
        fw.pnl += tradePnl;
      }

      if (t.lagMinutes !== null && t.lagMinutes !== undefined) {
        fw.totalLag += t.lagMinutes;
        fw.lagCount++;
        totalLagMinutes += t.lagMinutes;
        lagCount++;
      }

      followedWalletMap.set(fKey, fw);
    }

    // Token aggregation count
    const tKey = `${t.tokenAddress.toLowerCase()}_${t.tokenChain}`;
    const tokenItem = tokenPnlMap.get(tKey) ?? {
      tokenAddress: t.tokenAddress.toLowerCase() as Address,
      chain: prismaToChainSlug(t.tokenChain),
      symbol: t.token?.symbol || null,
      pnl: 0,
      count: 0,
    };
    tokenItem.count++;
    if (positions.length === 0 && isClosed) {
      tokenItem.pnl += tradePnl;
    }
    tokenPnlMap.set(tKey, tokenItem);
  }

  // Win rate
  const winRate =
    closedTradesCount > 0
      ? ((winningTradesCount / closedTradesCount) * 100).toFixed(1)
      : "0.0";

  // Average follow lag
  const avgFollowLagMinutes =
    lagCount > 0 ? Math.round(totalLagMinutes / lagCount) : null;

  // By followed wallet
  const byFollowedWallet: FollowedWalletPnlSummary[] = Array.from(
    followedWalletMap.values()
  ).map((fw) => ({
    address: fw.address,
    chain: fw.chain,
    label: fw.label,
    tradeCount: fw.tradeCount,
    pnlUsd: fw.pnl.toFixed(2),
    avgLagMinutes: fw.lagCount > 0 ? Math.round(fw.totalLag / fw.lagCount) : null,
  }));

  // By token
  const byToken: TokenPnlSummary[] = Array.from(tokenPnlMap.values()).map((tp) => ({
    tokenAddress: tp.tokenAddress,
    chain: tp.chain,
    symbol: tp.symbol,
    tradeCount: tp.count,
    pnlUsd: tp.pnl.toFixed(2),
  }));

  // By lag bucket (delegated to computeEdgeDecay for exact parity)
  const decayRes = await computeEdgeDecay({}, prisma);

  return {
    winRatePct: winRate,
    totalPnlUsd: totalRealizedPnl.toFixed(2),
    unrealizedPnlUsd: totalUnrealizedPnl.toFixed(2),
    avgFollowLagMinutes,
    totalTradesCount: trades.length,
    linkedTradesCount,
    byFollowedWallet,
    byToken,
    byLagBucket: decayRes.buckets,
  };
}
