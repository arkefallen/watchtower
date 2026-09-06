// src/server/services/movement/breadth.ts
import { prisma as defaultPrisma } from "@/server/db/client";
import type { PrismaClient, Chain } from "@/generated/prisma/client";

export interface BreadthInput {
  timeWindowHours?: number;
  chain?: Chain;
}

export interface BreadthResult {
  activeWalletsCount: number;
  denominatorCount: number;
  breadthPct: number;
  windowHours: number;
}

/**
 * Calculates market breadth indicator across the watchlist (FR-4.1, FR-6.1).
 * CRITICAL RULE (P5-T01): isSelf wallets are strictly EXCLUDED from the breadth denominator and numerator.
 */
export async function computeMarketBreadth(
  input: BreadthInput = {},
  injectedPrisma: PrismaClient = defaultPrisma
): Promise<BreadthResult> {
  const { timeWindowHours = 24, chain } = input;
  const since = new Date(Date.now() - timeWindowHours * 3600 * 1000);

  // Denominator: Total monitored non-self, non-blacklisted wallets
  const denominatorCount = await injectedPrisma.wallet.count({
    where: {
      isSelf: false, // Strict exclusion per P5-T01
      isBlacklisted: false,
      ...(chain ? { chain } : {}),
    },
  });

  if (denominatorCount === 0) {
    return {
      activeWalletsCount: 0,
      denominatorCount: 0,
      breadthPct: 0,
      windowHours: timeWindowHours,
    };
  }

  // Numerator: Distinct monitored non-self wallets with movements in window
  const activeEvents = await injectedPrisma.movementEvent.findMany({
    where: {
      timestamp: { gte: since },
      ...(chain ? { walletChain: chain } : {}),
      wallet: {
        isSelf: false, // Strict exclusion per P5-T01
        isBlacklisted: false,
      },
    },
    select: {
      walletAddress: true,
      walletChain: true,
    },
    distinct: ["walletAddress", "walletChain"],
  });

  const activeWalletsCount = activeEvents.length;
  const breadthPct = Number(((activeWalletsCount / denominatorCount) * 100).toFixed(2));

  return {
    activeWalletsCount,
    denominatorCount,
    breadthPct,
    windowHours: timeWindowHours,
  };
}
