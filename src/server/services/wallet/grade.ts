// src/server/services/wallet/grade.ts
import { prisma as defaultPrisma } from "@/server/db/client";
import type { PrismaClient, Chain } from "@/generated/prisma/client";
import { formatWalletLabel } from "@/lib/format/wallet-label";
import { chainSlugToPrisma, prismaToChainSlug } from "./normalize";
import type { ChainSlug, Address } from "@/lib/chains/types";

export interface WalletGradePositionInput {
  isOpen: boolean;
  realizedUsd: number | string | { toString(): string };
  entryMarketCap?: number | string | { toString(): string } | null;
  peakMarketCap?: number | string | { toString(): string } | null;
  avgEntryPriceUsd?: number | string | { toString(): string } | null;
  peakPriceUsd?: number | string | { toString(): string } | null;
}

export interface WalletGradeResult {
  available: boolean;
  sampleSize: number;
  closedPositionsCount: number;
  profitablePositionsCount: number;
  winRate: number | null; // e.g. 0.6 (60%)
  winRatePct: number | null; // e.g. 60
  realizedPnlUsd: string | null;
  entryTimingRatio: number | null;
  gradeLabel: string | null;
  unavailableReason?: "INSUFFICIENT_SAMPLE" | "NO_POSITIONS" | null;
  computedAt: string;
}

export interface ComputeWalletGradeOptions {
  walletAddress: string;
  chain: Chain | ChainSlug;
  minSampleSize?: number;
  positions?: WalletGradePositionInput[];
  walletTags?: {
    edgeTag?: string | null;
    styleTag?: string | null;
    sizeTag?: string | null;
  };
}

export const DEFAULT_MIN_GRADE_SAMPLE_SIZE = 3;

/**
 * Pure computation function for wallet auto-grading (FR-1.4, SRS Phase 6 DoD).
 */
export function calculateWalletGrade(
  positions: WalletGradePositionInput[],
  tags?: { edgeTag?: string | null; styleTag?: string | null; sizeTag?: string | null },
  options: { minSampleSize?: number; now?: Date } = {}
): WalletGradeResult {
  const minSampleSize = options.minSampleSize ?? DEFAULT_MIN_GRADE_SAMPLE_SIZE;
  const computedAt = (options.now ?? new Date()).toISOString();

  const gradeLabel = tags
    ? formatWalletLabel({
        edge: tags.edgeTag,
        style: tags.styleTag,
        size: tags.sizeTag,
      }) || null
    : null;

  // Filter closed positions only
  const closedPositions = positions.filter((p) => !p.isOpen);
  const sampleSize = closedPositions.length;

  if (sampleSize < minSampleSize) {
    return {
      available: false,
      sampleSize,
      closedPositionsCount: sampleSize,
      profitablePositionsCount: closedPositions.filter((p) => Number(p.realizedUsd) > 0).length,
      winRate: null,
      winRatePct: null,
      realizedPnlUsd: null,
      entryTimingRatio: null,
      gradeLabel,
      unavailableReason: sampleSize === 0 ? "NO_POSITIONS" : "INSUFFICIENT_SAMPLE",
      computedAt,
    };
  }

  let totalRealized = 0;
  let profitableCount = 0;
  const timingRatios: number[] = [];

  for (const pos of closedPositions) {
    const realized = Number(pos.realizedUsd);
    totalRealized += realized;
    if (realized > 0) {
      profitableCount += 1;
    }

    // Compute entry-timing ratio: entry MC / peak MC
    let ratio: number | null = null;
    const entryMc = pos.entryMarketCap !== null && pos.entryMarketCap !== undefined ? Number(pos.entryMarketCap) : null;
    const peakMc = pos.peakMarketCap !== null && pos.peakMarketCap !== undefined ? Number(pos.peakMarketCap) : null;

    if (entryMc && peakMc && peakMc > 0) {
      ratio = entryMc / peakMc;
    } else {
      const avgPrice = pos.avgEntryPriceUsd !== null && pos.avgEntryPriceUsd !== undefined ? Number(pos.avgEntryPriceUsd) : null;
      const peakPrice = pos.peakPriceUsd !== null && pos.peakPriceUsd !== undefined ? Number(pos.peakPriceUsd) : null;
      if (avgPrice && peakPrice && peakPrice > 0) {
        ratio = avgPrice / peakPrice;
      }
    }

    if (ratio !== null && Number.isFinite(ratio) && ratio > 0) {
      timingRatios.push(Math.min(1, Math.max(0.0001, ratio)));
    }
  }

  const winRateRaw = sampleSize > 0 ? profitableCount / sampleSize : 0;
  const winRate = Math.round(winRateRaw * 1000) / 1000; // e.g. 0.6
  const winRatePct = Math.round(winRateRaw * 1000) / 10; // e.g. 60.0

  const entryTimingRatio =
    timingRatios.length > 0
      ? Math.round((timingRatios.reduce((sum, r) => sum + r, 0) / timingRatios.length) * 1000) / 1000
      : null;

  return {
    available: true,
    sampleSize,
    closedPositionsCount: sampleSize,
    profitablePositionsCount: profitableCount,
    winRate,
    winRatePct,
    realizedPnlUsd: totalRealized.toFixed(2),
    entryTimingRatio,
    gradeLabel,
    unavailableReason: null,
    computedAt,
  };
}

/**
 * Computes wallet grade and persists it to WalletProfile.gradeJson in PostgreSQL.
 */
export async function computeAndPersistWalletGrade(
  options: ComputeWalletGradeOptions,
  injectedPrisma: PrismaClient = defaultPrisma
): Promise<WalletGradeResult> {
  const { walletAddress, chain, minSampleSize = DEFAULT_MIN_GRADE_SAMPLE_SIZE } = options;
  const normAddress = walletAddress.toLowerCase();
  const prismaChain: Chain =
    typeof chain === "string" && (chain === "base" || chain === "bsc" || chain === "robinhood")
      ? chainSlugToPrisma(chain as ChainSlug)
      : (chain as Chain);

  // If positions and tags were passed directly (e.g. in tests/mocked scenarios)
  if (options.positions && options.walletTags) {
    const result = calculateWalletGrade(options.positions, options.walletTags, { minSampleSize });
    // If DB is available, update profile
    if (injectedPrisma?.walletProfile) {
      await injectedPrisma.walletProfile.upsert({
        where: {
          walletAddress_walletChain: {
            walletAddress: normAddress,
            walletChain: prismaChain,
          },
        },
        create: {
          walletAddress: normAddress,
          walletChain: prismaChain,
          heatmapJson: {},
          gradeJson: result as unknown as object,
        },
        update: {
          gradeJson: result as unknown as object,
        },
      });
    }
    return result;
  }

  // Load wallet tags
  const wallet = await injectedPrisma.wallet.findUnique({
    where: {
      address_chain: {
        address: normAddress,
        chain: prismaChain,
      },
    },
    select: {
      edge: true,
      style: true,
      size: true,
    },
  });

  // Load positions with token details for peak market cap
  const positionRows = await injectedPrisma.position.findMany({
    where: {
      walletAddress: normAddress,
      walletChain: prismaChain,
    },
    include: {
      token: {
        select: {
          latestMarketCap: true,
        },
      },
    },
  });

  const positions: WalletGradePositionInput[] = positionRows.map((p) => ({
    isOpen: p.isOpen,
    realizedUsd: p.realizedUsd,
    entryMarketCap: p.entryMarketCap,
    peakMarketCap: p.token?.latestMarketCap ?? null,
    avgEntryPriceUsd: p.avgEntryPriceUsd,
    peakPriceUsd: p.peakPriceUsd,
  }));

  const result = calculateWalletGrade(
    positions,
    {
      edgeTag: wallet?.edge,
      styleTag: wallet?.style,
      sizeTag: wallet?.size,
    },
    { minSampleSize }
  );

  // Persist to WalletProfile
  await injectedPrisma.walletProfile.upsert({
    where: {
      walletAddress_walletChain: {
        walletAddress: normAddress,
        walletChain: prismaChain,
      },
    },
    create: {
      walletAddress: normAddress,
      walletChain: prismaChain,
      heatmapJson: {},
      gradeJson: result as unknown as object,
    },
    update: {
      gradeJson: result as unknown as object,
    },
  });

  return result;
}
