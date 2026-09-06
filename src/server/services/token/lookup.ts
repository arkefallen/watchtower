// src/server/services/token/lookup.ts
import { prisma as defaultPrisma } from "@/server/db/client";
import type { PrismaClient, Chain } from "@/generated/prisma/client";
import { chainSlugToPrisma, prismaToChainSlug } from "@/server/services/wallet/normalize";
import type { ChainSlug, Address } from "@/lib/chains/types";
import { formatWalletLabel } from "@/lib/format/wallet-label";
import { evaluateTokenRedFlags, type TokenRedFlagsResult } from "./red-flags";

export type HolderPositionStatus = "HOLDING" | "DISTRIBUTED" | "EXITED";

export interface TrackedHolderSummary {
  walletAddress: string;
  ensName: string | null;
  label: string | null;
  grade: unknown;
  entryMarketCap: string | null;
  status: HolderPositionStatus;
  amountRaw: string;
  holdingsUsd: string;
  shareOfTrackedPct: number;
  openedAt: string | null;
  closedAt: string | null;
}

export interface NetflowWindowStats {
  buyUsd: number;
  sellUsd: number;
  netUsd: number;
  buyCount: number;
  sellCount: number;
}

export interface TokenNetflowSummary {
  window24h: NetflowWindowStats;
  window7d: NetflowWindowStats;
  window30d: NetflowWindowStats;
  history: Array<{
    date: string;
    buyUsd: number;
    sellUsd: number;
    netUsd: number;
  }>;
}

export interface ClusterPresenceWarning {
  clusterId: string;
  clusterName: string;
  colorHex: string | null;
  walletCount: number;
  wallets: string[];
}

export interface TokenSupplyConcentration {
  trackedWalletsCount: number;
  totalTrackedHoldingsUsd: number;
  trackedSupplySharePct: number | null;
  top10ExplorerSharePct: number | null;
}

export interface TokenLookupResult {
  isKnown: boolean;
  tokenAddress: string;
  chain: string;
  token: {
    address: string;
    chain: string;
    symbol: string | null;
    name: string | null;
    decimals: number | null;
    deployedAt: string | null;
    deployerAddress: string | null;
    tokenAgeDays: number | null;
    latestPriceUsd: string | null;
    latestMarketCap: string | null;
    latestPriceAt: string | null;
  } | null;
  holders: TrackedHolderSummary[];
  netflow: TokenNetflowSummary;
  clusterWarnings: ClusterPresenceWarning[];
  redFlags: TokenRedFlagsResult | null;
  supplyConcentration: TokenSupplyConcentration;
  renderDurationMs: number;
}

export interface LookupTokenOptions {
  tokenAddress: string;
  chain: Chain | ChainSlug;
  now?: Date;
  mockData?: {
    token?: any;
    positions?: any[];
    movements?: any[];
    clusters?: any[];
    redFlags?: any;
  };
}

/**
 * Derives position status per FR-7.1:
 * - EXITED: position is closed or holding amount is 0
 * - DISTRIBUTED: position is open, but has CEX deposits or sell events recorded
 * - HOLDING: position is open with no distribution
 */
export function deriveHolderStatus(position: {
  isOpen: boolean;
  amountRaw?: string | null;
  cexDepositedUsd?: number | string | { toString(): string } | null;
  sellCount?: number | null;
}): HolderPositionStatus {
  if (!position.isOpen || position.amountRaw === "0" || !position.amountRaw) {
    return "EXITED";
  }

  const cexVal = position.cexDepositedUsd ? Number(position.cexDepositedUsd) : 0;
  const sells = position.sellCount ?? 0;

  if (cexVal > 0 || sells > 0) {
    return "DISTRIBUTED";
  }

  return "HOLDING";
}

/**
 * Fast, local-only token intelligence lookup (SRS §8 Acceptance SLA: < 3s).
 */
export async function lookupTokenDetails(
  options: LookupTokenOptions,
  injectedPrisma: PrismaClient = defaultPrisma
): Promise<TokenLookupResult> {
  const startTime = performance.now();
  const { tokenAddress, chain, now = new Date() } = options;
  const normToken = tokenAddress.toLowerCase();
  const chainSlug: ChainSlug =
    typeof chain === "string" && (chain === "base" || chain === "bsc" || chain === "robinhood")
      ? (chain as ChainSlug)
      : prismaToChainSlug(chain as Chain);
  const prismaChain: Chain = chainSlugToPrisma(chainSlug);

  // If mock data provided (for isolated testing)
  if (options.mockData) {
    const { token, positions = [], movements = [], clusters = [], redFlags } = options.mockData;
    const isKnown = !!token;

    let totalTrackedUsd = 0;
    const holderItems: TrackedHolderSummary[] = positions.map((p) => {
      const status = deriveHolderStatus(p);
      const holdingsUsdNum = p.unrealizedUsd ? Number(p.unrealizedUsd) : p.costUsd ? Number(p.costUsd) : 0;
      if (status !== "EXITED") {
        totalTrackedUsd += holdingsUsdNum;
      }
      return {
        walletAddress: p.walletAddress.toLowerCase(),
        ensName: p.wallet?.ensName ?? null,
        label: p.wallet ? formatWalletLabel({ edge: p.wallet.edge, style: p.wallet.style, size: p.wallet.size }) || null : null,
        grade: p.wallet?.profile?.gradeJson ?? null,
        entryMarketCap: p.entryMarketCap ? String(p.entryMarketCap) : null,
        status,
        amountRaw: p.amountRaw ?? "0",
        holdingsUsd: holdingsUsdNum.toFixed(2),
        shareOfTrackedPct: 0,
        openedAt: p.openedAt ? new Date(p.openedAt).toISOString() : null,
        closedAt: p.closedAt ? new Date(p.closedAt).toISOString() : null,
      };
    });

    for (const h of holderItems) {
      if (totalTrackedUsd > 0 && h.status !== "EXITED") {
        h.shareOfTrackedPct = Math.round((Number(h.holdingsUsd) / totalTrackedUsd) * 1000) / 10;
      }
    }

    const duration = performance.now() - startTime;
    return {
      isKnown,
      tokenAddress: normToken,
      chain: chainSlug,
      token: isKnown
        ? {
            address: normToken,
            chain: chainSlug,
            symbol: token.symbol ?? null,
            name: token.name ?? null,
            decimals: token.decimals ?? null,
            deployedAt: token.deployedAt ? new Date(token.deployedAt).toISOString() : null,
            deployerAddress: token.deployerAddress ?? null,
            tokenAgeDays: token.deployedAt ? Math.max(0, Math.floor((now.getTime() - new Date(token.deployedAt).getTime()) / (1000 * 3600 * 24))) : null,
            latestPriceUsd: token.latestPriceUsd ? String(token.latestPriceUsd) : null,
            latestMarketCap: token.latestMarketCap ? String(token.latestMarketCap) : null,
            latestPriceAt: token.latestPriceAt ? new Date(token.latestPriceAt).toISOString() : null,
          }
        : null,
      holders: holderItems,
      netflow: computeNetflowStats(movements, now),
      clusterWarnings: clusters,
      redFlags: redFlags ?? null,
      supplyConcentration: {
        trackedWalletsCount: holderItems.filter((h) => h.status !== "EXITED").length,
        totalTrackedHoldingsUsd: Math.round(totalTrackedUsd * 100) / 100,
        trackedSupplySharePct: token?.latestMarketCap && Number(token.latestMarketCap) > 0 ? Math.round((totalTrackedUsd / Number(token.latestMarketCap)) * 1000) / 10 : null,
        top10ExplorerSharePct: redFlags?.top10SharePct ?? null,
      },
      renderDurationMs: Math.round(duration),
    };
  }

  // 1. Fetch Token from PostgreSQL
  const tokenRecord = await injectedPrisma.token.findUnique({
    where: {
      address_chain: {
        address: normToken,
        chain: prismaChain,
      },
    },
  });

  if (!tokenRecord) {
    const duration = performance.now() - startTime;
    return {
      isKnown: false,
      tokenAddress: normToken,
      chain: chainSlug,
      token: null,
      holders: [],
      netflow: {
        window24h: { buyUsd: 0, sellUsd: 0, netUsd: 0, buyCount: 0, sellCount: 0 },
        window7d: { buyUsd: 0, sellUsd: 0, netUsd: 0, buyCount: 0, sellCount: 0 },
        window30d: { buyUsd: 0, sellUsd: 0, netUsd: 0, buyCount: 0, sellCount: 0 },
        history: [],
      },
      clusterWarnings: [],
      redFlags: null,
      supplyConcentration: {
        trackedWalletsCount: 0,
        totalTrackedHoldingsUsd: 0,
        trackedSupplySharePct: null,
        top10ExplorerSharePct: null,
      },
      renderDurationMs: Math.round(duration),
    };
  }

  // 2. Fetch Tracked Holders (Positions)
  const positionRows = await injectedPrisma.position.findMany({
    where: {
      tokenAddress: normToken,
      tokenChain: prismaChain,
    },
    include: {
      wallet: {
        include: {
          profile: true,
          clusterLinks: {
            include: {
              cluster: true,
            },
          },
        },
      },
    },
    orderBy: {
      openedAt: "desc",
    },
  });

  let totalTrackedHoldingsUsd = 0;
  const holders: TrackedHolderSummary[] = [];

  for (const pos of positionRows) {
    const status = deriveHolderStatus(pos);
    const holdingsVal = pos.unrealizedUsd ? Number(pos.unrealizedUsd) : pos.costUsd ? Number(pos.costUsd) : 0;
    if (status !== "EXITED") {
      totalTrackedHoldingsUsd += holdingsVal;
    }

    const label = pos.wallet
      ? formatWalletLabel({
          edge: pos.wallet.edge,
          style: pos.wallet.style,
          size: pos.wallet.size,
        }) || null
      : null;

    holders.push({
      walletAddress: pos.walletAddress,
      ensName: pos.wallet?.ensName ?? null,
      label,
      grade: pos.wallet?.profile?.gradeJson ?? null,
      entryMarketCap: pos.entryMarketCap ? pos.entryMarketCap.toString() : null,
      status,
      amountRaw: pos.amountRaw,
      holdingsUsd: holdingsVal.toFixed(2),
      shareOfTrackedPct: 0,
      openedAt: pos.openedAt ? pos.openedAt.toISOString() : null,
      closedAt: pos.closedAt ? pos.closedAt.toISOString() : null,
    });
  }

  // Compute share of tracked supply
  for (const h of holders) {
    if (totalTrackedHoldingsUsd > 0 && h.status !== "EXITED") {
      h.shareOfTrackedPct = Math.round((Number(h.holdingsUsd) / totalTrackedHoldingsUsd) * 1000) / 10;
    }
  }

  // 3. Netflow History (from MovementEvent)
  const movementRows = await injectedPrisma.movementEvent.findMany({
    where: {
      tokenAddress: normToken,
      tokenChain: prismaChain,
    },
    orderBy: {
      timestamp: "asc",
    },
    select: {
      kind: true,
      amountUsd: true,
      timestamp: true,
    },
  });

  const netflow = computeNetflowStats(movementRows, now);

  // 4. Cluster Co-Presence Warnings
  const clusterMap = new Map<string, { name: string; color: string | null; wallets: Set<string> }>();
  for (const pos of positionRows) {
    if (deriveHolderStatus(pos) === "EXITED") continue;
    if (pos.wallet?.clusterLinks) {
      for (const link of pos.wallet.clusterLinks) {
        const c = link.cluster;
        if (!c) continue;
        const entry = clusterMap.get(c.id) ?? {
          name: c.name,
          color: c.colorHex,
          wallets: new Set<string>(),
        };
        entry.wallets.add(pos.walletAddress);
        clusterMap.set(c.id, entry);
      }
    }
  }

  const clusterWarnings: ClusterPresenceWarning[] = [];
  for (const [clusterId, info] of clusterMap.entries()) {
    if (info.wallets.size >= 2) {
      clusterWarnings.push({
        clusterId,
        clusterName: info.name,
        colorHex: info.color,
        walletCount: info.wallets.size,
        wallets: Array.from(info.wallets),
      });
    }
  }

  // 5. Red flags from Token record
  const redFlags = (tokenRecord.redFlagJson as unknown as TokenRedFlagsResult) ?? null;

  // 6. Token age
  let tokenAgeDays: number | null = null;
  if (tokenRecord.deployedAt) {
    const diff = now.getTime() - tokenRecord.deployedAt.getTime();
    tokenAgeDays = Math.max(0, Math.floor(diff / (1000 * 3600 * 24)));
  }

  const marketCapNum = tokenRecord.latestMarketCap ? Number(tokenRecord.latestMarketCap) : null;
  const trackedSupplySharePct =
    marketCapNum && marketCapNum > 0
      ? Math.round((totalTrackedHoldingsUsd / marketCapNum) * 1000) / 10
      : null;

  const duration = performance.now() - startTime;

  return {
    isKnown: true,
    tokenAddress: normToken,
    chain: chainSlug,
    token: {
      address: normToken,
      chain: chainSlug,
      symbol: tokenRecord.symbol,
      name: tokenRecord.name,
      decimals: tokenRecord.decimals,
      deployedAt: tokenRecord.deployedAt ? tokenRecord.deployedAt.toISOString() : null,
      deployerAddress: tokenRecord.deployerAddress,
      tokenAgeDays,
      latestPriceUsd: tokenRecord.latestPriceUsd ? tokenRecord.latestPriceUsd.toString() : null,
      latestMarketCap: tokenRecord.latestMarketCap ? tokenRecord.latestMarketCap.toString() : null,
      latestPriceAt: tokenRecord.latestPriceAt ? tokenRecord.latestPriceAt.toISOString() : null,
    },
    holders,
    netflow,
    clusterWarnings,
    redFlags,
    supplyConcentration: {
      trackedWalletsCount: holders.filter((h) => h.status !== "EXITED").length,
      totalTrackedHoldingsUsd: Math.round(totalTrackedHoldingsUsd * 100) / 100,
      trackedSupplySharePct,
      top10ExplorerSharePct: redFlags?.top10SharePct ?? null,
    },
    renderDurationMs: Math.round(duration),
  };
}

/**
 * Aggregates netflow history across 24h, 7d, 30d windows and time series.
 */
function computeNetflowStats(
  movements: Array<{ kind: string; amountUsd: number | string | { toString(): string } | null; timestamp: Date }>,
  now: Date
): TokenNetflowSummary {
  const ms24h = 24 * 3600 * 1000;
  const ms7d = 7 * 24 * 3600 * 1000;
  const ms30d = 30 * 24 * 3600 * 1000;

  const nowMs = now.getTime();

  const window24h: NetflowWindowStats = { buyUsd: 0, sellUsd: 0, netUsd: 0, buyCount: 0, sellCount: 0 };
  const window7d: NetflowWindowStats = { buyUsd: 0, sellUsd: 0, netUsd: 0, buyCount: 0, sellCount: 0 };
  const window30d: NetflowWindowStats = { buyUsd: 0, sellUsd: 0, netUsd: 0, buyCount: 0, sellCount: 0 };

  const dailyMap = new Map<string, { buyUsd: number; sellUsd: number }>();

  for (const m of movements) {
    const usd = m.amountUsd ? Number(m.amountUsd) : 0;
    const isBuy = m.kind === "BUY";
    const isSell = m.kind === "SELL";
    if (!isBuy && !isSell) continue;

    const t = m.timestamp.getTime();
    const age = nowMs - t;

    if (age <= ms24h) {
      if (isBuy) {
        window24h.buyUsd += usd;
        window24h.buyCount += 1;
      } else {
        window24h.sellUsd += usd;
        window24h.sellCount += 1;
      }
    }

    if (age <= ms7d) {
      if (isBuy) {
        window7d.buyUsd += usd;
        window7d.buyCount += 1;
      } else {
        window7d.sellUsd += usd;
        window7d.sellCount += 1;
      }
    }

    if (age <= ms30d) {
      if (isBuy) {
        window30d.buyUsd += usd;
        window30d.buyCount += 1;
      } else {
        window30d.sellUsd += usd;
        window30d.sellCount += 1;
      }
    }

    const dateKey = m.timestamp.toISOString().split("T")[0];
    const dayEntry = dailyMap.get(dateKey) ?? { buyUsd: 0, sellUsd: 0 };
    if (isBuy) dayEntry.buyUsd += usd;
    if (isSell) dayEntry.sellUsd += usd;
    dailyMap.set(dateKey, dayEntry);
  }

  window24h.netUsd = Math.round((window24h.buyUsd - window24h.sellUsd) * 100) / 100;
  window7d.netUsd = Math.round((window7d.buyUsd - window7d.sellUsd) * 100) / 100;
  window30d.netUsd = Math.round((window30d.buyUsd - window30d.sellUsd) * 100) / 100;

  const history = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date,
      buyUsd: Math.round(d.buyUsd * 100) / 100,
      sellUsd: Math.round(d.sellUsd * 100) / 100,
      netUsd: Math.round((d.buyUsd - d.sellUsd) * 100) / 100,
    }));

  return {
    window24h,
    window7d,
    window30d,
    history,
  };
}
