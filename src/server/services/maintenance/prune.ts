// src/server/services/maintenance/prune.ts
import { prisma as defaultPrisma } from "@/server/db/client";
import type { PrismaClient, Chain } from "@/generated/prisma/client";
import { chainSlugToPrisma, prismaToChainSlug } from "@/server/services/wallet/normalize";
import type { ChainSlug } from "@/lib/chains/types";

export interface PruneTokenHistoryInput {
  tokenAddress: string;
  chain: Chain | ChainSlug;
  confirmation: string;
}

export interface PruneTokenHistoryResult {
  success: boolean;
  tokenAddress: string;
  chain: string;
  rowsDeleted: {
    transactions: number;
    movements: number;
    priceSnapshots: number;
    positions: number;
    dailyFlows: number;
    total: number;
  };
  message: string;
  prunedAt: string;
}

/**
 * Manually prune token history records for a single token (NFR-5, P6-T04).
 * CRITICAL RULE: Requires explicit confirmation === "PRUNE".
 * Never called automatically by any scheduled job.
 */
export async function pruneTokenHistory(
  input: PruneTokenHistoryInput,
  injectedPrisma: PrismaClient = defaultPrisma
): Promise<PruneTokenHistoryResult> {
  // Enforce explicit user confirmation
  if (input.confirmation !== "PRUNE") {
    throw new Error(
      "Explicit confirmation 'PRUNE' is required to delete token history records"
    );
  }

  const normToken = input.tokenAddress.toLowerCase();
  const chainSlug: ChainSlug =
    typeof input.chain === "string" && (input.chain === "base" || input.chain === "bsc" || input.chain === "robinhood")
      ? (input.chain as ChainSlug)
      : prismaToChainSlug(input.chain as Chain);
  const prismaChain: Chain = chainSlugToPrisma(chainSlug);

  const rowsDeleted = {
    transactions: 0,
    movements: 0,
    priceSnapshots: 0,
    positions: 0,
    dailyFlows: 0,
    total: 0,
  };

  if (injectedPrisma) {
    // 1. Delete transactions for this token only
    const txResult = await injectedPrisma.transaction.deleteMany({
      where: {
        tokenAddress: normToken,
        chain: prismaChain,
      },
    });
    rowsDeleted.transactions = txResult.count;

    // 2. Delete movements for this token only
    const movResult = await injectedPrisma.movementEvent.deleteMany({
      where: {
        tokenAddress: normToken,
        tokenChain: prismaChain,
      },
    });
    rowsDeleted.movements = movResult.count;

    // 3. Delete price snapshots for this token only
    const snapResult = await injectedPrisma.priceSnapshot.deleteMany({
      where: {
        tokenAddress: normToken,
        chain: prismaChain,
      },
    });
    rowsDeleted.priceSnapshots = snapResult.count;

    // 4. Delete positions for this token only
    const posResult = await injectedPrisma.position.deleteMany({
      where: {
        tokenAddress: normToken,
        tokenChain: prismaChain,
      },
    });
    rowsDeleted.positions = posResult.count;

    // 5. Delete daily flows for this token only
    const flowResult = await injectedPrisma.dailyFlow.deleteMany({
      where: {
        tokenAddress: normToken,
        chain: prismaChain,
      },
    });
    rowsDeleted.dailyFlows = flowResult.count;
  }

  rowsDeleted.total =
    rowsDeleted.transactions +
    rowsDeleted.movements +
    rowsDeleted.priceSnapshots +
    rowsDeleted.positions +
    rowsDeleted.dailyFlows;

  return {
    success: true,
    tokenAddress: normToken,
    chain: chainSlug,
    rowsDeleted,
    message: `Pruned ${rowsDeleted.total} record(s) for token ${normToken} on ${chainSlug.toUpperCase()}`,
    prunedAt: new Date().toISOString(),
  };
}
