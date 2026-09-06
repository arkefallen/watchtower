// src/lib/rules/types.ts
import type { AlertType, AlertState, Chain, TxKind, MovementKind } from "@/generated/prisma/client";
import type { AlertThresholds, GradedDefinition } from "@/lib/settings-schema";

export type RuleThresholds = AlertThresholds & {
  gradedDefinition?: GradedDefinition;
};

export type Address = string;
export type ChainSlug = "base" | "bsc" | "robinhood";
export type EntityKind = "CEX" | "BRIDGE" | "ROUTER" | "CONTRACT" | "HUMAN";

export interface MovementEventRow {
  id: string | bigint;
  walletAddress: Address;
  chain: ChainSlug;
  kind: MovementKind;
  tokenAddress?: Address | null;
  tokenSymbol?: string | null;
  amountRaw: string;
  amountUsd: string | null;
  priceUsdAtAction?: string | null;
  marketCapAtAction?: string | null;
  tokenAgeSeconds?: number | null;
  timestamp: Date;
  txHash?: string;
  isFirstEntryForWallet?: boolean;
  counterpartyAddress?: Address | null;
  counterpartyEntityKind?: EntityKind | null;
  counterpartyEntityName?: string | null;
}

export interface PositionRow {
  id?: string | bigint;
  walletAddress: Address;
  walletChain: ChainSlug;
  tokenAddress: Address;
  tokenChain: ChainSlug;
  tokenSymbol?: string | null;
  amountRaw: string;
  costUsd: string;
  realizedUsd: string;
  avgEntryPriceUsd: string;
  entryMarketCap?: string | null;
  peakPriceUsd?: string | null;
  peakPriceAt?: Date | null;
  unrealizedUsd?: string | null;
  unrealizedMultiple?: string | null;
  buyCount: number;
  sellCount: number;
  cexDepositedUsd: string;
  isOpen: boolean;
  openedAt: Date;
  closedAt?: Date | null;
}

export interface RuleContext {
  wallet: {
    address: Address;
    chain: ChainSlug;
    watchPriority: "HIGH" | "NORMAL";
    isSelf: boolean;
    gradeLabel: string | null;
    hasGrade: boolean;
    edgeTags?: string[];
    styleTags?: string[];
    sizeTags?: string[];
    tags?: string[];
    computedGrade?: string | null;
    sampleCount?: number;
    minSample?: number;
  };
  state: {
    current: "IDLE" | "ARMED" | "TRIGGERED";
    armedAt: Date | null;
    triggeredAt: Date | null;
    stablePeakUsd: string | null;
    stablePeakAt: Date | null;
    baselineStableUsd: string | null;
    baselineNativeUsd: string | null;
    deArmStreakDays: number;
  };
  /** Events inside the rule's lookback, already USD-priced and ordered. */
  events: MovementEventRow[];
  /** Pre-computed baselines so rules stay pure. */
  stats: {
    medianDailyStableInflowUsd: string | null;
    medianDailyNativeInflowUsd: string | null;
    stableBalanceUsd: string | null;
    nativeBalanceUsd: string | null;
    lastActivityAt: Date | null;
    dormantDays: number | null;
  };
  positions: PositionRow[];
  cluster: {
    id: string;
    name: string;
    memberAddresses: Array<{ address: Address; chain: ChainSlug }>;
  } | null;
  /** Peers used by T2/C2: independence already resolved (§4.7). */
  peerActivity: Array<{
    wallet: { address: Address; chain: ChainSlug };
    tokenAddress: Address;
    kind: "BUY" | "SELL" | "CEX_DEPOSIT";
    at: Date;
    amountUsd: string | null;
    independentOfSubject: boolean;
    sameCluster: boolean;
    hasGrade: boolean;
  }>;
  fundingEvents: Array<{
    from: Address;
    to?: Address;
    at: Date;
    amountUsd: string | null;
    fromEntityKind: EntityKind | null;
    fromEntityName: string | null;
    wasFundedByWallet: boolean;
    isTerminal?: boolean;
    txHash?: string;
  }>;
  thresholds: AlertThresholds & { gradedDefinition?: import("@/lib/settings-schema").GradedDefinition };
  gradedDefinition?: import("@/lib/settings-schema").GradedDefinition;
  now: Date;
}

export interface RuleFinding {
  type: AlertType;
  state: "ARMED" | "TRIGGERED" | "EXIT_RISK";
  occurredAt: Date;
  token: { address: Address; chain: ChainSlug; symbol: string | null } | null;
  amountUsd: string | null;
  clusterId: string | null;
  /** Machine payload for the alert row and downstream UI. */
  payload: Record<string, unknown>;
  /** FR-5.5: the exact rule, thresholds, observed numbers, and tx links. */
  evidence: {
    ruleId: AlertType;
    ruleText: string;
    thresholds: Record<string, string | number>;
    observed: Record<string, string | number | null>;
    txLinks: Array<{ hash: string; url: string; label: string }>;
    windows?: Record<string, string>;
  };
  /** "<type>:<wallet>:<chain>:<token|->:<bucket>" — unique per logical firing. */
  dedupeKey: string;
}

export type RuleFn = (ctx: RuleContext) => RuleFinding[];

export interface AlertRule {
  id: AlertType;
  title: string;
  category: "ARMING" | "TRIGGER" | "EXIT_RISK";
  /** How far back the evaluator must load events for this rule in milliseconds. */
  lookback: (t: AlertThresholds) => number;
  evaluate: RuleFn;
}

export interface EvaluateAlertsInput {
  mode: "INCREMENTAL" | "BACKFILL";
  scope?: { address?: Address; chain?: ChainSlug };
  from?: Date;
  to?: Date;
  rules?: AlertType[];
  onProgress?: (progress: { percent: number; message: string }) => void | Promise<void>;
}

export interface AlertEvaluateResult {
  mode: "INCREMENTAL" | "BACKFILL";
  walletsEvaluated: number;
  alertsCreated: number;
  alertsSuppressed: number;
  stateTransitions: number;
  durationMs: number;
}
