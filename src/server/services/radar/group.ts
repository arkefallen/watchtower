// src/server/services/radar/group.ts
import { prisma as defaultPrisma } from "@/server/db/client";
import type { PrismaClient, MovementGroupKind, Chain } from "@/generated/prisma/client";

export interface GroupEvaluationInput {
  timeWindowHours?: number;
  chain?: Chain;
  minWallets?: number;
}

/**
 * Service for evaluating co-accumulation / co-distribution movement groups (FR-4.2, FR-6.1).
 * CRITICAL RULE (P5-T01, FR-6.1): isSelf wallets are strictly EXCLUDED from co-accumulation membership.
 */
export async function evaluateMovementGroups(
  input: GroupEvaluationInput = {},
  injectedPrisma: PrismaClient = defaultPrisma
) {
  const { timeWindowHours = 24, chain, minWallets = 2 } = input;
  const since = new Date(Date.now() - timeWindowHours * 3600 * 1000);

  // Query BUY movements within the window for tracked NON-SELF wallets
  const buyMovements = await injectedPrisma.movementEvent.findMany({
    where: {
      kind: "BUY",
      timestamp: { gte: since },
      ...(chain ? { walletChain: chain } : {}),
      wallet: {
        isSelf: false, // Strict exclusion per P5-T01
        isBlacklisted: false,
      },
    },
    include: {
      wallet: true,
      token: true,
    },
  });

  // Group by token
  const tokenMap = new Map<string, typeof buyMovements>();
  for (const mov of buyMovements) {
    if (!mov.tokenAddress) continue;
    const key = `${mov.tokenAddress.toLowerCase()}_${mov.tokenChain}`;
    const list = tokenMap.get(key) ?? [];
    list.push(mov);
    tokenMap.set(key, list);
  }

  const detectedGroups = [];

  for (const [key, movements] of tokenMap.entries()) {
    const uniqueWallets = new Set(movements.map((m) => m.walletAddress.toLowerCase()));
    if (uniqueWallets.size >= minWallets) {
      const firstMov = movements[0];
      const combinedUsd = movements.reduce(
        (acc, m) => acc + (m.amountUsd ? Number(m.amountUsd) : 0),
        0
      );
      const minTime = movements.reduce(
        (min, m) => (m.timestamp < min ? m.timestamp : min),
        movements[0].timestamp
      );
      const maxTime = movements.reduce(
        (max, m) => (m.timestamp > max ? m.timestamp : max),
        movements[0].timestamp
      );

      detectedGroups.push({
        tokenAddress: firstMov.tokenAddress,
        chain: firstMov.tokenChain,
        kind: "CO_ACCUMULATION" as MovementGroupKind,
        windowStart: minTime,
        windowEnd: maxTime,
        combinedUsd,
        walletCount: uniqueWallets.size,
        wallets: Array.from(uniqueWallets),
        movementIds: movements.map((m) => m.id),
      });
    }
  }

  return detectedGroups;
}

/**
 * Filter predicate verifying if a wallet is allowed in co-accumulation groups.
 */
export function isEligibleForMovementGroup(wallet: { isSelf?: boolean | null; isBlacklisted?: boolean | null }): boolean {
  if (wallet.isSelf) return false;
  if (wallet.isBlacklisted) return false;
  return true;
}
