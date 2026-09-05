import type { Address, ChainSlug, RawAmount } from "@/lib/chains/types";
import type { PrismaClient } from "@/generated/prisma/client";
import { FlowDirection } from "@/generated/prisma/client";
import { chainSlugToPrisma } from "@/server/services/wallet/normalize";

export interface FlowTxInput {
  chain: ChainSlug;
  hash: string;
  fromAddress: string;
  toAddress: string | null;
  tokenAddress: string | null;
  amountRaw: RawAmount;
  amountUsd: string | null;
  timestamp: Date;
  isCexCounterparty?: boolean;
}

export async function rollTransactionsIntoDailyFlow(
  prisma: PrismaClient,
  args: {
    walletAddress: Address;
    chain: ChainSlug;
    transactions: FlowTxInput[];
    stableTokens: string[];
  }
): Promise<number> {
  const { walletAddress, chain, transactions, stableTokens } = args;
  const normalizedWallet = walletAddress.toLowerCase();
  const prismaChain = chainSlugToPrisma(chain);
  const stableSet = new Set(stableTokens.map((t) => t.toLowerCase()));

  // Map of composite key -> aggregated flow
  interface FlowBucket {
    walletAddress: string;
    chain: typeof prismaChain;
    tokenAddress: string | null;
    day: Date;
    direction: FlowDirection;
    isCexCounterparty: boolean;
    isStable: boolean;
    amountUsdSum: number;
    amountRawSum: bigint;
    eventsCount: number;
  }

  const buckets = new Map<string, FlowBucket>();

  for (const tx of transactions) {
    const fromNorm = tx.fromAddress.toLowerCase();
    const toNorm = tx.toAddress?.toLowerCase() ?? null;

    let direction: FlowDirection | null = null;
    if (toNorm === normalizedWallet) {
      direction = FlowDirection.IN;
    } else if (fromNorm === normalizedWallet) {
      direction = FlowDirection.OUT;
    }

    if (!direction) continue;

    const tokenLower = tx.tokenAddress ? tx.tokenAddress.toLowerCase() : null;
    const isStable = tokenLower ? stableSet.has(tokenLower) : false;
    const isCexCounterparty = tx.isCexCounterparty ?? false;

    // Day truncated UTC
    const ts = tx.timestamp;
    const day = new Date(Date.UTC(ts.getUTCFullYear(), ts.getUTCMonth(), ts.getUTCDate()));
    const dayStr = day.toISOString().slice(0, 10);

    const key = `${normalizedWallet}:${prismaChain}:${tokenLower ?? "NATIVE"}:${dayStr}:${direction}:${isCexCounterparty}`;

    const existing = buckets.get(key);
    const usd = tx.amountUsd ? parseFloat(tx.amountUsd) : 0;
    const rawVal = BigInt(tx.amountRaw || "0");

    if (existing) {
      existing.amountUsdSum += usd;
      existing.amountRawSum += rawVal;
      existing.eventsCount++;
    } else {
      buckets.set(key, {
        walletAddress: normalizedWallet,
        chain: prismaChain,
        tokenAddress: tokenLower,
        day,
        direction,
        isCexCounterparty,
        isStable,
        amountUsdSum: usd,
        amountRawSum: rawVal,
        eventsCount: 1,
      });
    }
  }

  // Persist buckets into DailyFlow
  let upsertedCount = 0;
  for (const bucket of buckets.values()) {
    await prisma.dailyFlow.upsert({
      where: {
        daily_flow_key: {
          walletAddress: bucket.walletAddress,
          chain: bucket.chain,
          tokenAddress: bucket.tokenAddress ?? "",
          day: bucket.day,
          direction: bucket.direction,
          isCexCounterparty: bucket.isCexCounterparty,
        },
      },
      create: {
        walletAddress: bucket.walletAddress,
        chain: bucket.chain,
        tokenAddress: bucket.tokenAddress,
        day: bucket.day,
        direction: bucket.direction,
        isCexCounterparty: bucket.isCexCounterparty,
        isStable: bucket.isStable,
        amountUsd: bucket.amountUsdSum.toFixed(8),
        amountRaw: bucket.amountRawSum.toString(),
        eventsCount: bucket.eventsCount,
      },
      update: {
        amountUsd: bucket.amountUsdSum.toFixed(8),
        amountRaw: bucket.amountRawSum.toString(),
        eventsCount: bucket.eventsCount,
        isStable: bucket.isStable,
      },
    });
    upsertedCount++;
  }

  return upsertedCount;
}
