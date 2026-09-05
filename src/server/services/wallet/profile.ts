import type { Address, ChainSlug } from "@/lib/chains/types";
import { computeHeatmaps, type HeatmapData } from "./heatmap";
import type { PrismaClient } from "@/generated/prisma/client";
import { Chain } from "@/generated/prisma/client";
import { chainSlugToPrisma, prismaToChainSlug } from "./normalize";

export interface ProfileTxInput {
  timestamp: Date;
  tokenAddress: string | null;
  isError?: boolean;
  kind?: string;
}

export interface ComputeWalletProfileArgs {
  walletAddress: Address;
  chain: ChainSlug | Chain;
  transactions: ProfileTxInput[];
  stableTokens: string[];
  timezone: string;
  now?: Date;
  dormancyDays?: number;
  latestStableBalanceUsd?: string | null;
}

export interface ComputedWalletProfile {
  walletAddress: Address;
  walletChain: ChainSlug;
  txCount: number;
  firstTxAt: Date | null;
  lastTxAt: Date | null;
  firstMemecoinTradeAt: Date | null;
  walletAgeDaysAtFirstMemecoinTrade: number | null;
  distinctTokenCount: number;
  dormantSince: Date | null;
  stableBalanceUsd: string;
  heatmapJson: HeatmapData;
}

export function computeWalletProfile(args: ComputeWalletProfileArgs): ComputedWalletProfile {
  const {
    walletAddress,
    chain,
    transactions,
    stableTokens,
    timezone,
    now = new Date(),
    dormancyDays = 30,
    latestStableBalanceUsd,
  } = args;

  const chainSlug: ChainSlug =
    typeof chain === "string" && (chain === "base" || chain === "bsc" || chain === "robinhood")
      ? (chain as ChainSlug)
      : prismaToChainSlug(chain as Chain);

  const stableSet = new Set(stableTokens.map((t) => t.toLowerCase()));
  const txCount = transactions.length;

  if (txCount === 0) {
    return {
      walletAddress,
      walletChain: chainSlug,
      txCount: 0,
      firstTxAt: null,
      lastTxAt: null,
      firstMemecoinTradeAt: null,
      walletAgeDaysAtFirstMemecoinTrade: null,
      distinctTokenCount: 0,
      dormantSince: null,
      stableBalanceUsd: latestStableBalanceUsd ?? "0",
      heatmapJson: computeHeatmaps([], timezone, now),
    };
  }

  let firstTxAt: Date | null = null;
  let lastTxAt: Date | null = null;
  let firstMemecoinTradeAt: Date | null = null;
  const distinctTokens = new Set<string>();

  for (const tx of transactions) {
    const ts = tx.timestamp;
    if (!firstTxAt || ts < firstTxAt) firstTxAt = ts;
    if (!lastTxAt || ts > lastTxAt) lastTxAt = ts;

    if (tx.tokenAddress) {
      const normalizedToken = tx.tokenAddress.toLowerCase();
      if (!stableSet.has(normalizedToken)) {
        distinctTokens.add(normalizedToken);
        if (!firstMemecoinTradeAt || ts < firstMemecoinTradeAt) {
          firstMemecoinTradeAt = ts;
        }
      }
    }
  }

  let walletAgeDaysAtFirstMemecoinTrade: number | null = null;
  if (firstMemecoinTradeAt && firstTxAt) {
    const diffMs = firstMemecoinTradeAt.getTime() - firstTxAt.getTime();
    walletAgeDaysAtFirstMemecoinTrade = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  let dormantSince: Date | null = null;
  if (lastTxAt) {
    const thresholdMs = dormancyDays * 24 * 60 * 60 * 1000;
    if (now.getTime() - lastTxAt.getTime() > thresholdMs) {
      dormantSince = lastTxAt;
    }
  }

  const timestamps = transactions.map((t) => t.timestamp);
  const heatmapJson = computeHeatmaps(timestamps, timezone, now);

  return {
    walletAddress,
    walletChain: chainSlug,
    txCount,
    firstTxAt,
    lastTxAt,
    firstMemecoinTradeAt,
    walletAgeDaysAtFirstMemecoinTrade,
    distinctTokenCount: distinctTokens.size,
    dormantSince,
    stableBalanceUsd: latestStableBalanceUsd ?? "0",
    heatmapJson,
  };
}

export async function persistWalletProfile(
  prisma: PrismaClient,
  args: {
    walletAddress: Address;
    chain: ChainSlug | Chain;
    timezone: string;
    stableTokens: string[];
    now?: Date;
    dormancyDays?: number;
  }
): Promise<ComputedWalletProfile> {
  const { walletAddress, chain, timezone, stableTokens, now = new Date(), dormancyDays } = args;

  const prismaChain: Chain =
    typeof chain === "string" && (chain === "base" || chain === "bsc" || chain === "robinhood")
      ? chainSlugToPrisma(chain as ChainSlug)
      : (chain as Chain);

  const normalizedAddress = walletAddress.toLowerCase();

  // Load transactions for this wallet
  const txRows = await prisma.transaction.findMany({
    where: {
      chain: prismaChain,
      OR: [{ fromAddress: normalizedAddress }, { toAddress: normalizedAddress }],
    },
    select: {
      timestamp: true,
      tokenAddress: true,
      isError: true,
      kind: true,
    },
    orderBy: {
      timestamp: "asc",
    },
  });

  // Load latest stable balance from BalanceSnapshot if any
  const latestStableSnapshot = await prisma.balanceSnapshot.findFirst({
    where: {
      walletAddress: normalizedAddress,
      chain: prismaChain,
      isStable: true,
    },
    orderBy: {
      timestamp: "desc",
    },
  });

  const profile = computeWalletProfile({
    walletAddress,
    chain: prismaChain,
    transactions: txRows,
    stableTokens,
    timezone,
    now,
    dormancyDays,
    latestStableBalanceUsd: latestStableSnapshot?.balanceUsd?.toString() ?? "0",
  });

  await prisma.walletProfile.upsert({
    where: {
      walletAddress_walletChain: {
        walletAddress: normalizedAddress,
        walletChain: prismaChain,
      },
    },
    create: {
      walletAddress: normalizedAddress,
      walletChain: prismaChain,
      firstTxAt: profile.firstTxAt,
      firstMemecoinTradeAt: profile.firstMemecoinTradeAt,
      walletAgeDaysAtFirstMemecoinTrade: profile.walletAgeDaysAtFirstMemecoinTrade,
      txCount: profile.txCount,
      distinctTokenCount: profile.distinctTokenCount,
      stableBalanceUsd: profile.stableBalanceUsd,
      dormantSince: profile.dormantSince,
      lastActivityAt: profile.lastTxAt,
      heatmapJson: profile.heatmapJson as unknown as object,
      computedAt: now,
    },
    update: {
      firstTxAt: profile.firstTxAt,
      firstMemecoinTradeAt: profile.firstMemecoinTradeAt,
      walletAgeDaysAtFirstMemecoinTrade: profile.walletAgeDaysAtFirstMemecoinTrade,
      txCount: profile.txCount,
      distinctTokenCount: profile.distinctTokenCount,
      stableBalanceUsd: profile.stableBalanceUsd,
      dormantSince: profile.dormantSince,
      lastActivityAt: profile.lastTxAt,
      heatmapJson: profile.heatmapJson as unknown as object,
      computedAt: now,
    },
  });

  return profile;
}
