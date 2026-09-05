import type { Address, ChainSlug } from "@/lib/chains/types";
import type { PrismaClient } from "@/generated/prisma/client";
import { chainSlugToPrisma } from "@/server/services/wallet/normalize";

export interface OutflowSummary {
  realizedOutflowUsd: string;
  byDestination: Array<{ address: Address; usd: string }>;
}

export interface OutflowTxRow {
  toAddress: string | null;
  amountUsd: string | null;
  swapGroupKey?: string | null;
  isError?: boolean;
}

export function computeOutflowFromRows(rows: OutflowTxRow[]): OutflowSummary {
  let totalUsd = 0;
  const destMap = new Map<string, number>();

  for (const row of rows) {
    if (row.isError) continue;
    // Exclude swaps against DEX routers (identified by swapGroupKey) per D-3 / §4.5
    if (row.swapGroupKey) continue;
    if (!row.toAddress) continue;

    const usd = row.amountUsd ? parseFloat(row.amountUsd) : 0;
    if (usd > 0) {
      totalUsd += usd;
      const toNorm = row.toAddress.toLowerCase();
      destMap.set(toNorm, (destMap.get(toNorm) ?? 0) + usd);
    }
  }

  const byDestination: Array<{ address: Address; usd: string }> = Array.from(
    destMap.entries()
  ).map(([addr, usd]) => ({
    address: addr as Address,
    usd: usd.toFixed(8),
  }));

  return {
    realizedOutflowUsd: totalUsd.toFixed(8),
    byDestination,
  };
}

export async function computeOutflow(
  prisma: PrismaClient,
  walletAddress: Address,
  chain: ChainSlug
): Promise<OutflowSummary> {
  const normAddress = walletAddress.toLowerCase();
  const prismaChain = chainSlugToPrisma(chain);

  const txRows = await prisma.transaction.findMany({
    where: {
      fromAddress: normAddress,
      chain: prismaChain,
      isError: false,
    },
    select: {
      toAddress: true,
      amountUsd: true,
      swapGroupKey: true,
      isError: true,
    },
  });

  const rows: OutflowTxRow[] = txRows.map((r) => ({
    toAddress: r.toAddress,
    amountUsd: r.amountUsd?.toString() ?? null,
    swapGroupKey: r.swapGroupKey,
    isError: r.isError,
  }));

  return computeOutflowFromRows(rows);
}
