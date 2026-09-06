// src/server/services/self/link.ts
import { prisma as defaultPrisma } from "@/server/db/client";
import type { PrismaClient } from "@/generated/prisma/client";
import { chainSlugToPrisma, prismaToChainSlug } from "@/server/services/wallet/normalize";
import type { Address, ChainSlug } from "@/lib/chains/types";
import { isWalletGraded } from "@/lib/rules/graded";
import { loadSettings } from "@/server/services/settings";
import { getWalletTokenRoi, getLagBucket } from "./roi";

export interface LinkTradeInput {
  trade: {
    id: string;
    ownWallet: { address: Address | string; chain: ChainSlug };
    tokenAddress: Address | string;
    tokenChain: ChainSlug;
    side: "BUY" | "SELL";
    entryAt: Date;
    amountUsd: string;
    entryMarketCap: string | null;
  };
  /** Candidate lookback for a preceding graded-wallet entry. Default 7 days. */
  lookbackMs?: number;
  /** Only graded wallets qualify as a followed signal (FR-6.2). Default true. */
  requireGraded?: boolean;
}

export interface LinkTradeResult {
  followedWallet: { address: Address; chain: ChainSlug } | null;
  lagMinutes: number | null;
  lagMcDelta: string | null;
  walletRoiPct: string | null;
  userRoiPct: string | null;
  lagBucket: "0-1h" | "1-6h" | "6-24h" | ">24h" | null;
  evidence: {
    candidatesConsidered: number;
    chosenReason: string;
    rejected: Array<{ address: string; reason: string }>;
  };
}

/**
 * Links a user trade to the nearest preceding graded watchlist buy on the same token (FR-6.2, §4.10).
 */
export async function linkTradeToSignal(
  input: LinkTradeInput,
  injectedPrisma: PrismaClient = defaultPrisma
): Promise<LinkTradeResult> {
  const { trade, lookbackMs = 7 * 24 * 3600 * 1000, requireGraded = true } = input;
  const prisma = injectedPrisma;

  // 1. Check if the trade is pinned
  const existingTrade = await prisma.userTrade.findUnique({
    where: { id: trade.id },
  });

  if (existingTrade?.isLinkPinned && existingTrade.followedWalletAddress) {
    const slugChain = prismaToChainSlug(existingTrade.followedWalletChain!);
    const lagMinutes = existingTrade.lagMinutes;
    return {
      followedWallet: {
        address: existingTrade.followedWalletAddress as Address,
        chain: slugChain,
      },
      lagMinutes,
      lagMcDelta: existingTrade.lagMcDelta ? existingTrade.lagMcDelta.toString() : null,
      walletRoiPct: existingTrade.walletRoiPct ? existingTrade.walletRoiPct.toString() : null,
      userRoiPct: existingTrade.roiPct ? existingTrade.roiPct.toString() : null,
      lagBucket: (existingTrade.lagBucket as any) || getLagBucket(lagMinutes),
      evidence: {
        candidatesConsidered: 0,
        chosenReason: "PINNED_BY_USER",
        rejected: [],
      },
    };
  }

  // If trade is a SELL, auto-linking only triggers on BUYs unless manual attribution
  if (trade.side !== "BUY") {
    return {
      followedWallet: null,
      lagMinutes: null,
      lagMcDelta: null,
      walletRoiPct: null,
      userRoiPct: null,
      lagBucket: null,
      evidence: {
        candidatesConsidered: 0,
        chosenReason: "TRADE_IS_SELL",
        rejected: [],
      },
    };
  }

  const settings = await loadSettings();
  const gradedDefinition = settings.gradedDefinition ?? "ANY_TAG_OR_COMPUTED";

  const normUserAddress = trade.ownWallet.address.toLowerCase();
  const normTokenAddress = trade.tokenAddress.toLowerCase();
  const prismaChain = chainSlugToPrisma(trade.tokenChain);
  const lookbackStart = new Date(trade.entryAt.getTime() - lookbackMs);

  // 2. Fetch candidate BUY movements on the same token
  const candidateMovements = await prisma.movementEvent.findMany({
    where: {
      tokenAddress: normTokenAddress,
      tokenChain: prismaChain,
      kind: "BUY",
      timestamp: {
        lte: trade.entryAt, // Strict rule: Must be on or BEFORE user's entry
        gte: lookbackStart,
      },
    },
    include: {
      wallet: {
        include: {
          profile: true,
        },
      },
    },
    orderBy: {
      timestamp: "desc",
    },
  });

  const rejected: Array<{ address: string; reason: string }> = [];
  const qualifying: Array<{
    movement: typeof candidateMovements[0];
    address: string;
    chain: ChainSlug;
    timestamp: Date;
    amountUsd: number;
    watchPriority: "HIGH" | "NORMAL";
  }> = [];

  for (const mov of candidateMovements) {
    const candidateAddress = mov.walletAddress.toLowerCase();
    const candidateChain = prismaToChainSlug(mov.walletChain);

    // Rule: Exclude user's own wallet or any wallet marked isSelf
    if (candidateAddress === normUserAddress || mov.wallet.isSelf) {
      rejected.push({
        address: candidateAddress,
        reason: "EXCLUDED_SELF_WALLET",
      });
      continue;
    }

    // Rule: Must qualify under gradedDefinition if requireGraded is true
    if (requireGraded) {
      const edgeTags = mov.wallet.edge ? [mov.wallet.edge] : [];
      const styleTags = mov.wallet.style ? [mov.wallet.style] : [];
      const sizeTags = mov.wallet.size ? [mov.wallet.size] : [];

      const candidateProfile = mov.wallet.profile;
      const isGraded = isWalletGraded(
        {
          edgeTags,
          styleTags,
          sizeTags,
          computedGrade: candidateProfile?.gradeJson ? "AUTO_GRADE" : null,
          sampleCount: candidateProfile?.txCount ?? 0,
        },
        gradedDefinition
      );

      if (!isGraded) {
        rejected.push({
          address: candidateAddress,
          reason: `NOT_GRADED_${gradedDefinition}`,
        });
        continue;
      }
    }

    qualifying.push({
      movement: mov,
      address: candidateAddress,
      chain: candidateChain,
      timestamp: mov.timestamp,
      amountUsd: mov.amountUsd ? Number(mov.amountUsd) : 0,
      watchPriority: (mov.wallet.watchPriority as any) || "NORMAL",
    });
  }

  if (qualifying.length === 0) {
    const emptyResult: LinkTradeResult = {
      followedWallet: null,
      lagMinutes: null,
      lagMcDelta: null,
      walletRoiPct: null,
      userRoiPct: null,
      lagBucket: null,
      evidence: {
        candidatesConsidered: candidateMovements.length,
        chosenReason: "NO_QUALIFYING_GRADED_CANDIDATE",
        rejected,
      },
    };

    await prisma.userTrade.update({
      where: { id: trade.id },
      data: {
        followedWalletAddress: null,
        followedWalletChain: null,
        lagMinutes: null,
        lagMcDelta: null,
        lagBucket: null,
        linkEvidenceJson: emptyResult.evidence as any,
        linkedAt: new Date(),
      },
    });

    return emptyResult;
  }

  // 3. Deterministic Sorting & Tie-Breaking:
  // Primary: Nearest in time before user entry (highest timestamp <= user entryAt)
  // Tie 1: Higher watchPriority ('HIGH' > 'NORMAL')
  // Tie 2: Larger USD amount (descending)
  // Tie 3: Lexicographic address (ascending)
  qualifying.sort((a, b) => {
    const timeDiff = b.timestamp.getTime() - a.timestamp.getTime();
    if (timeDiff !== 0) return timeDiff;

    if (a.watchPriority !== b.watchPriority) {
      return a.watchPriority === "HIGH" ? -1 : 1;
    }

    const usdDiff = b.amountUsd - a.amountUsd;
    if (usdDiff !== 0) return usdDiff;

    return a.address.localeCompare(b.address);
  });

  const chosen = qualifying[0];
  const chosenMovement = chosen.movement;

  // 4. Metrics Calculation
  const lagMinutes = Math.max(
    0,
    Math.round((trade.entryAt.getTime() - chosen.timestamp.getTime()) / 60000)
  );
  const lagBucket = getLagBucket(lagMinutes);

  let lagMcDelta: string | null = null;
  if (trade.entryMarketCap && chosenMovement.marketCapAtAction) {
    const userMc = Number(trade.entryMarketCap);
    const walletMc = Number(chosenMovement.marketCapAtAction);
    if (!isNaN(userMc) && !isNaN(walletMc)) {
      lagMcDelta = (userMc - walletMc).toFixed(2);
    }
  }

  // Fetch followed wallet ROI and user ROI
  const walletRoiRes = await getWalletTokenRoi(
    prisma,
    chosen.address,
    chosen.chain,
    normTokenAddress
  );
  const userRoiRes = await getWalletTokenRoi(
    prisma,
    normUserAddress,
    trade.ownWallet.chain,
    normTokenAddress
  );

  const walletRoiPct = walletRoiRes?.roiPct ?? null;
  const userRoiPct = userRoiRes?.roiPct ?? (existingTrade?.roiPct ? existingTrade.roiPct.toString() : null);

  const evidence = {
    candidatesConsidered: candidateMovements.length,
    chosenReason: `NEAREST_GRADED_ENTRY (${lagMinutes}m lag)`,
    rejected,
  };

  // 5. Persist Link to DB
  await prisma.userTrade.update({
    where: { id: trade.id },
    data: {
      followedWalletAddress: chosen.address,
      followedWalletChain: chainSlugToPrisma(chosen.chain),
      lagMinutes,
      lagMcDelta: lagMcDelta ? lagMcDelta : null,
      walletRoiPct: walletRoiPct ? walletRoiPct : null,
      roiPct: userRoiPct ? userRoiPct : undefined,
      lagBucket,
      followedEntryMarketCap: chosenMovement.marketCapAtAction
        ? chosenMovement.marketCapAtAction.toString()
        : null,
      linkEvidenceJson: evidence as any,
      linkedAt: new Date(),
    },
  });

  return {
    followedWallet: {
      address: chosen.address as Address,
      chain: chosen.chain,
    },
    lagMinutes,
    lagMcDelta,
    walletRoiPct,
    userRoiPct,
    lagBucket,
    evidence,
  };
}

/**
 * Iterates through unlinked trades of a user wallet and auto-links them.
 */
export async function linkAllUserTrades(
  walletAddress: string,
  chain: ChainSlug,
  injectedPrisma: PrismaClient = defaultPrisma
) {
  const normAddress = walletAddress.toLowerCase();
  const prismaChain = chainSlugToPrisma(chain);

  const trades = await injectedPrisma.userTrade.findMany({
    where: {
      ownWalletAddress: normAddress,
      ownChain: prismaChain,
      isLinkPinned: false, // Never overwrite pinned
    },
    include: {
      ownWallet: true,
    },
  });

  let linkedCount = 0;
  for (const t of trades) {
    const slugChain = prismaToChainSlug(t.ownChain);
    await linkTradeToSignal(
      {
        trade: {
          id: t.id,
          ownWallet: { address: t.ownWalletAddress as Address, chain: slugChain },
          tokenAddress: t.tokenAddress as Address,
          tokenChain: prismaToChainSlug(t.tokenChain),
          side: t.side as any,
          entryAt: t.entryAt,
          amountUsd: t.amountUsd ? t.amountUsd.toString() : "0",
          entryMarketCap: t.entryMarketCap ? t.entryMarketCap.toString() : null,
        },
      },
      injectedPrisma
    );
    linkedCount++;
  }

  return { total: trades.length, linkedCount };
}
