// src/server/services/alert/baselines.ts
import type { PrismaClient } from "@/generated/prisma/client";
import type { Address, ChainSlug } from "@/lib/chains/types";
import { parseUsd } from "@/lib/rules/guards";
import { chainSlugToPrisma } from "@/server/services/wallet/normalize";

export interface MedianInflowResult {
  medianUsd: number | null;
  medianStr: string | null;
  qualifyingDays: number;
  available: boolean;
}

/**
 * Computes median daily inflow from a list of daily values.
 * - Excludes non-positive / zero days (qualifying days must be > 0).
 * - Requires >= 7 qualifying days before reporting as available (returns null otherwise).
 * - For even-count lengths, uses standard midpoint (average of the two middle elements).
 */
export function computeInflowMedian(
  dailyInflows: Array<
    | number
    | string
    | { amountUsd?: number | string | null; amount?: number | string | null }
    | null
    | undefined
  >
): MedianInflowResult {
  const values: number[] = [];

  for (const item of dailyInflows) {
    if (item === null || item === undefined) continue;

    let rawVal: number | string | null | undefined;
    if (typeof item === "object") {
      rawVal = item.amountUsd ?? item.amount;
    } else {
      rawVal = item;
    }

    const num = parseUsd(rawVal);
    if (num !== null && num > 0) {
      values.push(num);
    }
  }

  const qualifyingDays = values.length;
  if (qualifyingDays < 7) {
    return {
      medianUsd: null,
      medianStr: null,
      qualifyingDays,
      available: false,
    };
  }

  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  let medianVal: number;

  if (values.length % 2 === 1) {
    medianVal = values[mid];
  } else {
    medianVal = (values[mid - 1] + values[mid]) / 2;
  }

  return {
    medianUsd: medianVal,
    medianStr: medianVal.toFixed(2),
    qualifyingDays,
    available: true,
  };
}

export interface ThirtyDayBaselineItem {
  date?: Date;
  day?: Date;
  timestamp?: Date;
  balanceUsd?: number | string | null;
  amountUsd?: number | string | null;
}

export interface ThirtyDayBaselineResult {
  baselineUsd: number | null;
  baselineStr: string | null;
  count: number;
  coveredDays: number;
}

/**
 * Computes the 30-day baseline used by the de-arm rule.
 * Covers exactly 30 days: [asOf - 30 days, asOf].
 * Any record outside this exact 30-day window is excluded.
 */
export function compute30DayBaseline(
  records: ThirtyDayBaselineItem[],
  asOf: Date = new Date()
): ThirtyDayBaselineResult {
  const windowMs = 30 * 24 * 60 * 60 * 1000;
  const startTime = asOf.getTime() - windowMs;
  const endTime = asOf.getTime();

  const windowRecords: number[] = [];

  for (const rec of records) {
    const d = rec.date ?? rec.day ?? rec.timestamp;
    if (!d) continue;
    const t = d.getTime();

    // Must be within [asOf - 30d, asOf]
    if (t >= startTime && t <= endTime) {
      const val = parseUsd(rec.balanceUsd ?? rec.amountUsd);
      if (val !== null) {
        windowRecords.push(val);
      }
    }
  }

  if (windowRecords.length === 0) {
    return {
      baselineUsd: null,
      baselineStr: null,
      count: 0,
      coveredDays: 0,
    };
  }

  const sum = windowRecords.reduce((acc, v) => acc + v, 0);
  const avg = sum / windowRecords.length;

  return {
    baselineUsd: avg,
    baselineStr: avg.toFixed(2),
    count: windowRecords.length,
    coveredDays: Math.min(30, windowRecords.length),
  };
}

/**
 * Loads and calculates stable & native median daily inflows from DailyFlow for a wallet.
 */
export async function getWalletInflowBaselines(
  prisma: PrismaClient,
  walletAddress: Address,
  chain: ChainSlug
): Promise<{
  medianDailyStableInflowUsd: string | null;
  medianDailyNativeInflowUsd: string | null;
  stableQualifyingDays: number;
  nativeQualifyingDays: number;
}> {
  const prismaChain = chainSlugToPrisma(chain);
  const flows = await prisma.dailyFlow.findMany({
    where: {
      walletAddress: walletAddress.toLowerCase(),
      chain: prismaChain,
      direction: "IN",
    },
    select: {
      day: true,
      amountUsd: true,
      isStable: true,
      tokenAddress: true,
    },
  });

  const stableFlows: number[] = [];
  const nativeFlows: number[] = [];

  for (const f of flows) {
    const usd = parseFloat(f.amountUsd.toString());
    if (f.isStable) {
      stableFlows.push(usd);
    }
    if (f.tokenAddress === null) {
      nativeFlows.push(usd);
    }
  }

  const stableMedian = computeInflowMedian(stableFlows);
  const nativeMedian = computeInflowMedian(nativeFlows);

  return {
    medianDailyStableInflowUsd: stableMedian.medianStr,
    medianDailyNativeInflowUsd: nativeMedian.medianStr,
    stableQualifyingDays: stableMedian.qualifyingDays,
    nativeQualifyingDays: nativeMedian.qualifyingDays,
  };
}
