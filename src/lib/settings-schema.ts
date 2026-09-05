import { z } from "zod";

export type ChainSlug = "base" | "bsc" | "robinhood";
export type CoEntryWindow = "1h" | "6h" | "24h" | "48h";
export type GradedDefinition = "ANY_TAG_OR_COMPUTED" | "EDGE_TAG_ONLY";

const addressSchema = z.string().regex(/^0x[a-f0-9]{40}$/, "must be a lowercase EVM address");
const nonNegativeNumber = z.number().finite().nonnegative();
const positiveInteger = z.number().int().min(1);

const stableTokenSchema = z.object({
  address: addressSchema,
  symbol: z.string().trim().min(1),
}).strict();

export const alertThresholdsSchema = z.object({
  a1MinStableInflowUsd: nonNegativeNumber,
  a1MedianMultiple: nonNegativeNumber,
  a1WindowHours: positiveInteger,
  a2MinNativeInflowUsd: nonNegativeNumber,
  a2MedianMultiple: nonNegativeNumber,
  a2WindowHours: positiveInteger,
  a3MinCexWithdrawalUsd: nonNegativeNumber,
  a4DormancyDays: positiveInteger,
  a4MinFundingUsd: nonNegativeNumber,
  a5MinWallets: positiveInteger,
  a5WindowHours: positiveInteger,
  a6MinSweepSources: positiveInteger,
  a6WindowHours: positiveInteger,
  t1MaxTokenAgeDays: positiveInteger,
  t1MinPositionUsd: nonNegativeNumber,
  t2MinWallets: positiveInteger,
  t2WindowHours: positiveInteger,
  t3MaxTokenAgeMinutes: positiveInteger,
  t4MinDrawdownPct: z.number().finite().min(0).max(100),
  t5MinWallets: positiveInteger,
  t5WindowHours: positiveInteger,
  c1MinDepositUsd: nonNegativeNumber,
  c2MinWallets: positiveInteger,
  c2WindowHours: positiveInteger,
  c3MinMultiple: nonNegativeNumber,
  c3MinAgeDays: positiveInteger,
  c3SelfOnly: z.boolean(),
  c4DropPct: z.number().finite().min(0).max(100),
  c4WindowHours: positiveInteger,
  deArmBaselinePct: nonNegativeNumber,
  deArmConsecutiveDays: positiveInteger,
}).strict();

export type AlertThresholds = z.infer<typeof alertThresholdsSchema>;

export const settingsSnapshotSchema = z.object({
  stableTokens: z.object({
    base: z.array(stableTokenSchema),
    bsc: z.array(stableTokenSchema),
    robinhood: z.array(stableTokenSchema),
  }).strict(),
  alertThresholds: alertThresholdsSchema,
  coEntryWindows: z.array(z.enum(["1h", "6h", "24h", "48h"])).min(1),
  defaultCoEntryWindow: z.enum(["1h", "6h", "24h", "48h"]),
  coAccumulationMinWallets: positiveInteger,
  syncCadenceMinutes: positiveInteger,
  radarCadenceMinutes: positiveInteger,
  minEdgeUsd: nonNegativeNumber,
  maxTraceDepth: z.number().int().min(1).max(6),
  profitSinkRatioPct: z.number().finite().min(0).max(100),
  gradedDefinition: z.enum(["ANY_TAG_OR_COMPUTED", "EDGE_TAG_ONLY"]),
  telegram: z.object({
    enabled: z.boolean(),
    hasCredentials: z.boolean(),
  }).strict(),
  timezone: z.string().trim().min(1),
  defaultChain: z.enum(["base", "bsc", "robinhood"]),
  quota: z.object({
    etherscanDailyLimit: positiveInteger,
    reservedForInteractivePct: z.number().finite().min(0).max(100),
  }).strict(),
  priceCacheTtlSeconds: positiveInteger,
}).strict();

export type SettingsSnapshot = z.infer<typeof settingsSnapshotSchema>;
export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export const DEFAULT_SETTINGS: SettingsSnapshot = settingsSnapshotSchema.parse({
  stableTokens: {
    base: [{ address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", symbol: "USDC" }],
    bsc: [{ address: "0x55d398326f99059ff775485246999027b3197955", symbol: "USDT" }],
    robinhood: [{ address: "0x5fc5360d0400a0fd4f2af552add042d716f1d168", symbol: "USDG" }],
  },
  alertThresholds: {
    a1MinStableInflowUsd: 1000, a1MedianMultiple: 3, a1WindowHours: 24,
    a2MinNativeInflowUsd: 100, a2MedianMultiple: 3, a2WindowHours: 24,
    a3MinCexWithdrawalUsd: 1000, a4DormancyDays: 30, a4MinFundingUsd: 500,
    a5MinWallets: 2, a5WindowHours: 48, a6MinSweepSources: 2, a6WindowHours: 48,
    t1MaxTokenAgeDays: 7, t1MinPositionUsd: 500, t2MinWallets: 2, t2WindowHours: 24,
    t3MaxTokenAgeMinutes: 60, t4MinDrawdownPct: 20, t5MinWallets: 2, t5WindowHours: 1,
    c1MinDepositUsd: 0, c2MinWallets: 2, c2WindowHours: 12, c3MinMultiple: 10,
    c3MinAgeDays: 3, c3SelfOnly: false, c4DropPct: 70, c4WindowHours: 48,
    deArmBaselinePct: 120, deArmConsecutiveDays: 7,
  },
  coEntryWindows: ["1h", "6h", "24h", "48h"],
  defaultCoEntryWindow: "24h",
  coAccumulationMinWallets: 2,
  syncCadenceMinutes: 15,
  radarCadenceMinutes: 5,
  minEdgeUsd: 100,
  maxTraceDepth: 3,
  profitSinkRatioPct: 20,
  gradedDefinition: "ANY_TAG_OR_COMPUTED",
  telegram: { enabled: false, hasCredentials: false },
  timezone: "Asia/Jakarta",
  defaultChain: "base",
  quota: { etherscanDailyLimit: 100_000, reservedForInteractivePct: 10 },
  priceCacheTtlSeconds: 60,
});
