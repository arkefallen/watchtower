// src/server/services/alert/context.ts
import { prisma as defaultPrisma } from "@/server/db/client";
import type { PrismaClient } from "@/generated/prisma/client";
import type { ChainSlug } from "@/lib/chains/types";
import type {
  RuleContext,
  MovementEventRow,
  PositionRow,
  EntityKind,
  Address,
} from "@/lib/rules/types";
import type { AlertThresholds } from "@/lib/settings-schema";
import { loadSettings } from "@/server/services/settings";
import {
  chainSlugToPrisma,
  prismaToChainSlug,
  normalizeAddress,
} from "@/server/services/wallet/normalize";

export interface LoadRuleContextOptions {
  now?: Date;
  lookbackMs?: number;
  thresholds?: AlertThresholds;
  prisma?: PrismaClient;
  gradedDefinition?: "ANY_TAG_OR_COMPUTED" | "EDGE_TAG_ONLY";
}

function calculateMedian(values: number[]): string | null {
  if (values.length < 7) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return median.toFixed(2);
}

/**
 * Loads the complete RuleContext for a given wallet and chain,
 * fulfilling SRS §5 and watchtower-implementation-plan §4.8.
 */
export async function loadRuleContext(
  walletAddress: string,
  chain: ChainSlug,
  options?: LoadRuleContextOptions
): Promise<RuleContext> {
  const normAddress = normalizeAddress(walletAddress);
  const prismaChain = chainSlugToPrisma(chain);
  const prisma = options?.prisma ?? defaultPrisma;
  const now = options?.now ?? new Date();

  // 1. Settings & Thresholds
  let thresholds = options?.thresholds;
  let gradedDef = options?.gradedDefinition;
  if (!thresholds || !gradedDef) {
    const settings = await loadSettings();
    thresholds = thresholds ?? settings.alertThresholds;
    gradedDef = gradedDef ?? settings.gradedDefinition;
  }

  // 2. Wallet & Profile
  const walletRow = await prisma.wallet.findUnique({
    where: {
      address_chain: {
        address: normAddress,
        chain: prismaChain,
      },
    },
    include: {
      profile: true,
    },
  });

  const hasEdge = !!walletRow?.edge;
  const hasStyleOrSize = !!(walletRow?.style || walletRow?.size);
  const hasComputedGrade = !!(walletRow?.profile?.gradeJson);
  const hasGrade = gradedDef === "EDGE_TAG_ONLY" ? hasEdge : (hasEdge || hasStyleOrSize || hasComputedGrade);

  const gradeLabels: string[] = [];
  if (walletRow?.edge) gradeLabels.push(walletRow.edge);
  if (walletRow?.style) gradeLabels.push(walletRow.style);
  if (walletRow?.size) gradeLabels.push(walletRow.size);
  const gradeLabel = gradeLabels.length > 0 ? gradeLabels.join("-") : null;

  const wallet = {
    address: normAddress as Address,
    chain,
    watchPriority: (walletRow?.watchPriority ?? "NORMAL") as "HIGH" | "NORMAL",
    isSelf: walletRow?.isSelf ?? false,
    gradeLabel,
    hasGrade,
  };

  // 3. Wallet State
  const stateRow = await prisma.walletState.findUnique({
    where: {
      walletAddress_walletChain: {
        walletAddress: normAddress,
        walletChain: prismaChain,
      },
    },
  });

  const state = {
    current: (stateRow?.state ?? "IDLE") as "IDLE" | "ARMED" | "TRIGGERED",
    armedAt: stateRow?.armedAt ?? null,
    triggeredAt: stateRow?.triggeredAt ?? null,
    stablePeakUsd: stateRow?.stablePeakUsd?.toString() ?? null,
    stablePeakAt: stateRow?.stablePeakAt ?? null,
    baselineStableUsd: stateRow?.baselineStableUsd?.toString() ?? null,
    baselineNativeUsd: stateRow?.baselineNativeUsd?.toString() ?? null,
    deArmStreakDays: stateRow?.deArmStreakDays ?? 0,
  };

  // 4. Movement Events within lookback
  const defaultLookback = 30 * 24 * 3600 * 1000; // 30 days default
  const lookbackMs = options?.lookbackMs ?? defaultLookback;
  const since = new Date(now.getTime() - lookbackMs);

  const rawEvents = await prisma.movementEvent.findMany({
    where: {
      walletAddress: normAddress,
      walletChain: prismaChain,
      timestamp: {
        gte: since,
        lte: now,
      },
    },
    orderBy: {
      timestamp: "asc",
    },
  });

  const events: MovementEventRow[] = rawEvents.map((e) => ({
    id: e.id,
    walletAddress: e.walletAddress as Address,
    chain: prismaToChainSlug(e.walletChain),
    kind: e.kind,
    tokenAddress: e.tokenAddress ? (e.tokenAddress as Address) : null,
    tokenSymbol: e.tokenSymbol ?? null,
    amountRaw: e.amountRaw,
    amountUsd: e.amountUsd ? e.amountUsd.toString() : null,
    priceUsdAtAction: e.priceUsdAtAction ? e.priceUsdAtAction.toString() : null,
    marketCapAtAction: e.marketCapAtAction ? e.marketCapAtAction.toString() : null,
    tokenAgeSeconds: e.tokenAgeSeconds ? Number(e.tokenAgeSeconds) : null,
    timestamp: e.timestamp,
    txHash: e.txHash,
    isFirstEntryForWallet: e.isFirstEntryForWallet,
    counterpartyAddress: e.counterpartyAddress ? (e.counterpartyAddress as Address) : null,
    counterpartyEntityName: e.counterpartyEntityName ?? null,
  }));

  // 5. Daily Flow Stats (Medians & Baselines)
  const flowSince = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const flows = await prisma.dailyFlow.findMany({
    where: {
      walletAddress: normAddress,
      chain: prismaChain,
      direction: "IN",
      day: {
        gte: flowSince,
        lte: now,
      },
    },
  });

  const stableInflows: number[] = [];
  const nativeInflows: number[] = [];

  for (const f of flows) {
    const amount = f.amountUsd ? parseFloat(f.amountUsd.toString()) : 0;
    if (amount > 0) {
      if (f.isStable) {
        stableInflows.push(amount);
      }
      if (f.tokenAddress === null) {
        nativeInflows.push(amount);
      }
    }
  }

  const medianDailyStableInflowUsd = calculateMedian(stableInflows);
  const medianDailyNativeInflowUsd = calculateMedian(nativeInflows);

  const lastActivityAt = walletRow?.profile?.lastActivityAt ?? null;
  const dormantDays = lastActivityAt
    ? Math.max(0, Math.floor((now.getTime() - lastActivityAt.getTime()) / (24 * 3600 * 1000)))
    : null;

  const stats = {
    medianDailyStableInflowUsd,
    medianDailyNativeInflowUsd,
    stableBalanceUsd: walletRow?.profile?.stableBalanceUsd?.toString() ?? null,
    nativeBalanceUsd: walletRow?.profile?.nativeBalanceUsd?.toString() ?? null,
    lastActivityAt,
    dormantDays,
  };

  // 6. Positions
  const rawPositions = await prisma.position.findMany({
    where: {
      walletAddress: normAddress,
      walletChain: prismaChain,
    },
  });

  const positions: PositionRow[] = rawPositions.map((p) => ({
    id: p.id,
    walletAddress: p.walletAddress as Address,
    walletChain: prismaToChainSlug(p.walletChain),
    tokenAddress: p.tokenAddress as Address,
    tokenChain: prismaToChainSlug(p.tokenChain),
    tokenSymbol: null,
    amountRaw: p.amountRaw,
    costUsd: p.costUsd.toString(),
    realizedUsd: p.realizedUsd.toString(),
    avgEntryPriceUsd: p.avgEntryPriceUsd ? p.avgEntryPriceUsd.toString() : "0",
    entryMarketCap: p.entryMarketCap ? p.entryMarketCap.toString() : null,
    peakPriceUsd: p.peakPriceUsd ? p.peakPriceUsd.toString() : null,
    peakPriceAt: p.peakPriceAt,
    unrealizedUsd: p.unrealizedUsd ? p.unrealizedUsd.toString() : null,
    unrealizedMultiple: p.unrealizedMultiple ? p.unrealizedMultiple.toString() : null,
    buyCount: p.buyCount,
    sellCount: p.sellCount,
    cexDepositedUsd: p.cexDepositedUsd.toString(),
    isOpen: p.isOpen,
    openedAt: p.openedAt,
    closedAt: p.closedAt,
  }));

  // 7. Cluster Membership
  const clusterMember = await prisma.clusterMember.findFirst({
    where: {
      walletAddress: normAddress,
      walletChain: prismaChain,
    },
    include: {
      cluster: {
        include: {
          members: true,
        },
      },
    },
  });

  const cluster = clusterMember
    ? {
        id: clusterMember.cluster.id,
        name: clusterMember.cluster.name,
        memberAddresses: clusterMember.cluster.members.map((m) => ({
          address: m.walletAddress as Address,
          chain: prismaToChainSlug(m.walletChain),
        })),
      }
    : null;

  // 8. Peer Activity (for T2 / C2)
  const peerWindow = 48 * 3600 * 1000;
  const peerSince = new Date(now.getTime() - peerWindow);
  const peerMovements = await prisma.movementEvent.findMany({
    where: {
      walletAddress: { not: normAddress },
      walletChain: prismaChain,
      timestamp: { gte: peerSince, lte: now },
      kind: { in: ["BUY", "SELL", "CEX_DEPOSIT"] },
    },
    include: {
      wallet: {
        include: { profile: true },
      },
    },
    take: 100,
  });

  const peerAddresses = [...new Set(peerMovements.map((m) => m.walletAddress))];
  const relations = peerAddresses.length > 0
    ? await prisma.walletRelation.findMany({
        where: {
          OR: [
            { fromAddress: normAddress, toAddress: { in: peerAddresses } },
            { fromAddress: { in: peerAddresses }, toAddress: normAddress },
          ],
        },
      })
    : [];

  const relatedAddresses = new Set<string>();
  for (const r of relations) {
    if (r.fromAddress === normAddress) relatedAddresses.add(r.toAddress);
    if (r.toAddress === normAddress) relatedAddresses.add(r.fromAddress);
  }

  const clusterMemberSet = new Set(cluster?.memberAddresses.map((m) => m.address) ?? []);

  const peerActivity: RuleContext["peerActivity"] = peerMovements.map((pm) => {
    const peerHasEdge = !!pm.wallet?.edge;
    const peerHasStyle = !!(pm.wallet?.style || pm.wallet?.size);
    const peerHasComputed = !!pm.wallet?.profile?.gradeJson;
    const peerHasGrade = gradedDef === "EDGE_TAG_ONLY"
      ? peerHasEdge
      : (peerHasEdge || peerHasStyle || peerHasComputed);

    return {
      wallet: {
        address: pm.walletAddress as Address,
        chain: prismaToChainSlug(pm.walletChain),
      },
      tokenAddress: (pm.tokenAddress ?? "0x0000000000000000000000000000000000000000") as Address,
      kind: pm.kind as "BUY" | "SELL" | "CEX_DEPOSIT",
      at: pm.timestamp,
      amountUsd: pm.amountUsd ? pm.amountUsd.toString() : null,
      independentOfSubject: !relatedAddresses.has(pm.walletAddress),
      sameCluster: clusterMemberSet.has(pm.walletAddress as Address),
      hasGrade: peerHasGrade,
    };
  });

  // 9. Funding Events
  const fundingEdges = await prisma.fundingEdge.findMany({
    where: {
      childAddress: normAddress,
      childChain: prismaChain,
    },
  });

  const fundingEvents: RuleContext["fundingEvents"] = fundingEdges.map((fe) => ({
    from: fe.parentAddress as Address,
    at: fe.lastAt ?? now,
    amountUsd: fe.totalUsd ? fe.totalUsd.toString() : null,
    fromEntityKind: (fe.isTerminalEntity ? "CEX" : null) as EntityKind | null,
    fromEntityName: fe.entityName ?? null,
    wasFundedByWallet: fe.isRepeatedFunder || fe.fundedFirstGas,
    isTerminal: fe.isTerminalEntity,
  }));

  return {
    wallet,
    state,
    events,
    stats,
    positions,
    cluster,
    peerActivity,
    fundingEvents,
    thresholds,
    now,
  };
}
