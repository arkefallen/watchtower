import { Prisma, type Chain, type PrismaClient } from "@/generated/prisma/client";
import { getCanonicalPair } from "./canonical";

export interface AggregateEdgesScope {
  chain?: Chain;
  address?: string;
}

export interface AggregateEdgesResult {
  edgesCreatedOrUpdated: number;
  tokensCreatedOrUpdated: number;
}

interface RawInteractionTx {
  hash: string;
  chain: Chain;
  timestamp: Date;
  fromAddress: string;
  toAddress: string;
  tokenAddress: string | null;
  tokenSymbol: string | null;
  amountRaw: string;
  amountUsd: Prisma.Decimal | null;
}

interface TokenAgg {
  tokenAddress: string | null; // null for native
  chain: Chain;
  tokenSymbol: string | null;
  totalUsd: Prisma.Decimal;
  txCount: number;
  usdAToB: Prisma.Decimal;
  usdBToA: Prisma.Decimal;
  firstAt: Date;
  lastAt: Date;
  sampleTxs: Array<{
    hash: string;
    timestamp: string;
    direction: "A_TO_B" | "B_TO_A";
    amountRaw: string;
    amountUsd: string | null;
  }>;
}

interface PairAgg {
  addressA: string;
  chainA: Chain;
  addressB: string;
  chainB: Chain;
  totalUsd: Prisma.Decimal;
  txCount: number;
  usdAToB: Prisma.Decimal;
  usdBToA: Prisma.Decimal;
  countAToB: number;
  countBToA: number;
  firstAt: Date;
  lastAt: Date;
  tokens: Map<string, TokenAgg>; // key is tokenAddress ?? "__NATIVE__"
}

/**
 * Scans same-chain `Transaction` records where both `fromAddress` and `toAddress`
 * are tracked wallets, canonicalizes wallet pairs, and aggregates per pair and per token.
 * Never creates cross-chain edges (D-2).
 */
export async function aggregateInteractionEdges(
  prisma: PrismaClient,
  scope?: AggregateEdgesScope
): Promise<AggregateEdgesResult> {
  // 1. Get all tracked wallets
  const walletWhere: Prisma.WalletWhereInput = { isBlacklisted: false };
  if (scope?.chain) walletWhere.chain = scope.chain;
  if (scope?.address) walletWhere.address = scope.address.toLowerCase();

  const trackedWallets = await prisma.wallet.findMany({
    where: walletWhere,
    select: { address: true, chain: true },
  });

  if (trackedWallets.length === 0) {
    return { edgesCreatedOrUpdated: 0, tokensCreatedOrUpdated: 0 };
  }

  // Create a fast lookup map of tracked addresses per chain: `${chain}:${address}`
  const allTrackedWallets = await prisma.wallet.findMany({
    where: { isBlacklisted: false },
    select: { address: true, chain: true },
  });
  const trackedSet = new Set(allTrackedWallets.map((w) => `${w.chain}:${w.address.toLowerCase()}`));

  // 2. Query transactions where both from and to are present
  // Filter by scope if provided
  const txWhere: Prisma.TransactionWhereInput = {
    isError: false,
    toAddress: { not: null },
  };

  if (scope?.chain) {
    txWhere.chain = scope.chain;
  }

  if (scope?.address) {
    const addr = scope.address.toLowerCase();
    txWhere.OR = [
      { fromAddress: addr },
      { toAddress: addr },
    ];
  }

  const transactions = await prisma.transaction.findMany({
    where: txWhere,
    select: {
      hash: true,
      chain: true,
      timestamp: true,
      fromAddress: true,
      toAddress: true,
      tokenAddress: true,
      tokenSymbol: true,
      amountRaw: true,
      amountUsd: true,
    },
    orderBy: { timestamp: "asc" },
  });

  const pairAggs = new Map<string, PairAgg>();

  // Helper to get chain's native symbol
  const getNativeSymbol = (chain: Chain): string => {
    switch (chain) {
      case "BASE":
        return "ETH";
      case "BSC":
        return "BNB";
      case "ROBINHOOD":
        return "ETH";
      default:
        return "ETH";
    }
  };

  for (const tx of transactions) {
    if (!tx.toAddress) continue;
    const fromAddr = tx.fromAddress.toLowerCase();
    const toAddr = tx.toAddress.toLowerCase();

    // Must not be a self-transfer for an edge between two distinct wallets
    if (fromAddr === toAddr) continue;

    // Both must be tracked wallets on the transaction's chain (same chain only)
    const fromKey = `${tx.chain}:${fromAddr}`;
    const toKey = `${tx.chain}:${toAddr}`;
    if (!trackedSet.has(fromKey) || !trackedSet.has(toKey)) continue;

    const canonical = getCanonicalPair(fromAddr, tx.chain, toAddr, tx.chain);
    const pairKey = `${canonical.chainA}:${canonical.addressA}-${canonical.chainB}:${canonical.addressB}`;

    let pair = pairAggs.get(pairKey);
    if (!pair) {
      pair = {
        addressA: canonical.addressA,
        chainA: canonical.chainA,
        addressB: canonical.addressB,
        chainB: canonical.chainB,
        totalUsd: new Prisma.Decimal(0),
        txCount: 0,
        usdAToB: new Prisma.Decimal(0),
        usdBToA: new Prisma.Decimal(0),
        countAToB: 0,
        countBToA: 0,
        firstAt: tx.timestamp,
        lastAt: tx.timestamp,
        tokens: new Map(),
      };
      pairAggs.set(pairKey, pair);
    }

    const amountUsd = tx.amountUsd ?? new Prisma.Decimal(0);
    pair.totalUsd = pair.totalUsd.add(amountUsd);
    pair.txCount += 1;

    if (tx.timestamp < pair.firstAt) pair.firstAt = tx.timestamp;
    if (tx.timestamp > pair.lastAt) pair.lastAt = tx.timestamp;

    const isFromA = canonical.isOriginalOrder; // if original order, fromAddress was arg1 which is addressA
    if (isFromA) {
      pair.usdAToB = pair.usdAToB.add(amountUsd);
      pair.countAToB += 1;
    } else {
      pair.usdBToA = pair.usdBToA.add(amountUsd);
      pair.countBToA += 1;
    }

    // Token aggregation
    const tokenKey = tx.tokenAddress ? tx.tokenAddress.toLowerCase() : "__NATIVE__";
    let tokenAgg = pair.tokens.get(tokenKey);
    if (!tokenAgg) {
      tokenAgg = {
        tokenAddress: tx.tokenAddress ? tx.tokenAddress.toLowerCase() : null,
        chain: tx.chain,
        tokenSymbol: tx.tokenAddress ? tx.tokenSymbol : getNativeSymbol(tx.chain),
        totalUsd: new Prisma.Decimal(0),
        txCount: 0,
        usdAToB: new Prisma.Decimal(0),
        usdBToA: new Prisma.Decimal(0),
        firstAt: tx.timestamp,
        lastAt: tx.timestamp,
        sampleTxs: [],
      };
      pair.tokens.set(tokenKey, tokenAgg);
    }

    tokenAgg.totalUsd = tokenAgg.totalUsd.add(amountUsd);
    tokenAgg.txCount += 1;
    if (tx.timestamp < tokenAgg.firstAt) tokenAgg.firstAt = tx.timestamp;
    if (tx.timestamp > tokenAgg.lastAt) tokenAgg.lastAt = tx.timestamp;

    if (isFromA) {
      tokenAgg.usdAToB = tokenAgg.usdAToB.add(amountUsd);
    } else {
      tokenAgg.usdBToA = tokenAgg.usdBToA.add(amountUsd);
    }

    // Sample transactions (up to 25 newest)
    tokenAgg.sampleTxs.push({
      hash: tx.hash,
      timestamp: tx.timestamp.toISOString(),
      direction: isFromA ? "A_TO_B" : "B_TO_A",
      amountRaw: tx.amountRaw,
      amountUsd: tx.amountUsd ? tx.amountUsd.toString() : null,
    });
  }

  let edgesCount = 0;
  let tokensCount = 0;

  // 3. Upsert into database
  for (const pair of pairAggs.values()) {
    // Sort tokens by totalUsd descending to find top token
    const sortedTokens = Array.from(pair.tokens.values()).sort((a, b) =>
      b.totalUsd.comparedTo(a.totalUsd)
    );

    const topToken = sortedTokens[0];

    const edge = await prisma.interactionEdge.upsert({
      where: {
        interaction_edge_key: {
          addressA: pair.addressA,
          chainA: pair.chainA,
          addressB: pair.addressB,
          chainB: pair.chainB,
        },
      },
      create: {
        addressA: pair.addressA,
        chainA: pair.chainA,
        addressB: pair.addressB,
        chainB: pair.chainB,
        totalUsd: pair.totalUsd,
        txCount: pair.txCount,
        usdAToB: pair.usdAToB,
        usdBToA: pair.usdBToA,
        countAToB: pair.countAToB,
        countBToA: pair.countBToA,
        firstAt: pair.firstAt,
        lastAt: pair.lastAt,
        topTokenAddress: topToken?.tokenAddress ?? null,
        topTokenSymbol: topToken?.tokenSymbol ?? null,
        topTokenUsd: topToken?.totalUsd ?? null,
        distinctTokenCount: sortedTokens.length,
        computedAt: new Date(),
      },
      update: {
        totalUsd: pair.totalUsd,
        txCount: pair.txCount,
        usdAToB: pair.usdAToB,
        usdBToA: pair.usdBToA,
        countAToB: pair.countAToB,
        countBToA: pair.countBToA,
        firstAt: pair.firstAt,
        lastAt: pair.lastAt,
        topTokenAddress: topToken?.tokenAddress ?? null,
        topTokenSymbol: topToken?.tokenSymbol ?? null,
        topTokenUsd: topToken?.totalUsd ?? null,
        distinctTokenCount: sortedTokens.length,
        computedAt: new Date(),
      },
    });

    edgesCount += 1;

    // Upsert tokens for this edge
    for (const t of sortedTokens) {
      // Sort sample transactions newest first, max 25
      const recentSamples = t.sampleTxs
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 25);

      await prisma.interactionEdgeToken.upsert({
        where: {
          edgeId_tokenAddress: {
            edgeId: edge.id,
            tokenAddress: t.tokenAddress as string, // Prisma schema allows null via unique compound
          },
        },
        create: {
          edgeId: edge.id,
          tokenAddress: t.tokenAddress,
          chain: t.chain,
          tokenSymbol: t.tokenSymbol,
          totalUsd: t.totalUsd,
          txCount: t.txCount,
          usdAToB: t.usdAToB,
          usdBToA: t.usdBToA,
          firstAt: t.firstAt,
          lastAt: t.lastAt,
          sampleTxsJson: recentSamples as unknown as Prisma.InputJsonValue,
        },
        update: {
          tokenSymbol: t.tokenSymbol,
          totalUsd: t.totalUsd,
          txCount: t.txCount,
          usdAToB: t.usdAToB,
          usdBToA: t.usdBToA,
          firstAt: t.firstAt,
          lastAt: t.lastAt,
          sampleTxsJson: recentSamples as unknown as Prisma.InputJsonValue,
        },
      });

      tokensCount += 1;
    }
  }

  return {
    edgesCreatedOrUpdated: edgesCount,
    tokensCreatedOrUpdated: tokensCount,
  };
}
