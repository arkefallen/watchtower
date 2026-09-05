import type { Address, ChainSlug, RawAmount } from "@/lib/chains/types";
import type { PrismaClient, Chain } from "@/generated/prisma/client";
import { chainSlugToPrisma, prismaToChainSlug } from "@/server/services/wallet/normalize";
import type { SettingsSnapshot } from "@/server/services/settings";

export interface ParkingEvent {
  walletAddress: Address;
  chain: ChainSlug;
  tokenAddress: Address;
  tokenSymbol: string;
  direction: "IN" | "OUT";
  amountRaw: RawAmount;
  amountUsd: string | null;
  timestamp: Date;
  txHash: string;
  counterpartyAddress: Address | null;
  counterpartyEntityName: string | null;
}

export interface ParkingSummary {
  perChain: Array<{
    chain: ChainSlug;
    parkedUsd: string;
    byToken: Array<{
      tokenAddress: Address;
      symbol: string;
      balanceRaw: RawAmount;
      balanceUsd: string | null;
    }>;
  }>;
  totalParkedUsd: string;
  timeline: ParkingEvent[];
  peakUsd: string | null;
  peakAt: Date | null;
}

export interface ParkingTransferInput {
  chain: ChainSlug;
  hash: string;
  tokenAddress: Address;
  tokenSymbol?: string | null;
  from: Address;
  to: Address | null;
  amountRaw: RawAmount;
  amountUsd?: string | null;
  timestamp: Date;
}

export interface ParkingBalanceInput {
  chain: ChainSlug;
  tokenAddress: Address;
  symbol: string;
  balanceRaw: RawAmount;
  balanceUsd: string | null;
}

export interface ComputeParkingArgs {
  walletAddress: Address;
  transfers: ParkingTransferInput[];
  balances: ParkingBalanceInput[];
  stableTokensMap: Record<string, Address[]>;
  entityLabels?: Record<string, string>;
}

export function computeParkingFromTransfers(args: ComputeParkingArgs): ParkingSummary {
  const { walletAddress, transfers, balances, stableTokensMap, entityLabels = {} } = args;
  const normalizedWallet = walletAddress.toLowerCase();

  const timeline: ParkingEvent[] = [];

  for (const tx of transfers) {
    const chain = tx.chain;
    const stableList = stableTokensMap[chain] ?? [];
    const isConfiguredStable = stableList.some(
      (s) => s.toLowerCase() === tx.tokenAddress.toLowerCase()
    );

    if (!isConfiguredStable) continue;

    const fromNorm = tx.from.toLowerCase();
    const toNorm = tx.to?.toLowerCase() ?? null;

    let direction: "IN" | "OUT" | null = null;
    let counterparty: Address | null = null;

    if (toNorm === normalizedWallet) {
      direction = "IN";
      counterparty = tx.from;
    } else if (fromNorm === normalizedWallet) {
      direction = "OUT";
      counterparty = tx.to;
    }

    if (!direction) continue;

    const counterpartyEntityName = counterparty
      ? entityLabels[counterparty.toLowerCase()] ?? null
      : null;

    timeline.push({
      walletAddress,
      chain,
      tokenAddress: tx.tokenAddress.toLowerCase() as Address,
      tokenSymbol: tx.tokenSymbol ?? "STABLE",
      direction,
      amountRaw: tx.amountRaw,
      amountUsd: tx.amountUsd ?? null,
      timestamp: tx.timestamp,
      txHash: tx.hash,
      counterpartyAddress: counterparty,
      counterpartyEntityName,
    });
  }

  // Sort timeline chronologically
  timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Track running USD and peak parked USD
  let runningUsd = 0;
  let peakUsdVal = 0;
  let peakAt: Date | null = null;

  for (const event of timeline) {
    const usd = event.amountUsd ? parseFloat(event.amountUsd) : 0;
    if (event.direction === "IN") {
      runningUsd += usd;
    } else {
      runningUsd -= usd;
    }

    if (runningUsd > peakUsdVal) {
      peakUsdVal = runningUsd;
      peakAt = event.timestamp;
    }
  }

  // Group balances by chain
  const chainBalances = new Map<
    ChainSlug,
    Array<{
      tokenAddress: Address;
      symbol: string;
      balanceRaw: RawAmount;
      balanceUsd: string | null;
    }>
  >();

  for (const b of balances) {
    const chain = b.chain;
    const stableList = stableTokensMap[chain] ?? [];
    const isConfiguredStable = stableList.some(
      (s) => s.toLowerCase() === b.tokenAddress.toLowerCase()
    );
    if (!isConfiguredStable) continue;

    const list = chainBalances.get(chain) ?? [];
    list.push({
      tokenAddress: b.tokenAddress.toLowerCase() as Address,
      symbol: b.symbol,
      balanceRaw: b.balanceRaw,
      balanceUsd: b.balanceUsd,
    });
    chainBalances.set(chain, list);
  }

  let totalParkedUsdVal = 0;
  const perChain: ParkingSummary["perChain"] = [];

  for (const [chain, tokens] of chainBalances.entries()) {
    let chainParkedUsd = 0;
    for (const t of tokens) {
      if (t.balanceUsd) {
        chainParkedUsd += parseFloat(t.balanceUsd);
      }
    }
    totalParkedUsdVal += chainParkedUsd;
    perChain.push({
      chain,
      parkedUsd: chainParkedUsd.toFixed(8),
      byToken: tokens,
    });
  }

  return {
    perChain,
    totalParkedUsd: totalParkedUsdVal.toFixed(8),
    timeline,
    peakUsd: peakAt ? peakUsdVal.toFixed(8) : null,
    peakAt,
  };
}

export async function computeParking(
  address: Address,
  chain: ChainSlug,
  deps: { prisma: PrismaClient; settings: SettingsSnapshot }
): Promise<ParkingSummary> {
  const { prisma, settings } = deps;
  const normalizedWallet = address.toLowerCase();

  // Load configured stable tokens
  const stableTokensMap: Record<string, Address[]> = {};
  for (const [ch, tokens] of Object.entries(settings.stableTokens ?? {})) {
    stableTokensMap[ch] = (tokens as Array<{ address: string }>).map(
      (t) => t.address.toLowerCase() as Address
    );
  }

  // Load stable token transfers
  const allStables = Object.values(stableTokensMap).flat();
  const txRows = await prisma.transaction.findMany({
    where: {
      tokenAddress: { in: allStables },
      OR: [{ fromAddress: normalizedWallet }, { toAddress: normalizedWallet }],
    },
    select: {
      chain: true,
      hash: true,
      tokenAddress: true,
      tokenSymbol: true,
      fromAddress: true,
      toAddress: true,
      amountRaw: true,
      amountUsd: true,
      timestamp: true,
    },
    orderBy: {
      timestamp: "asc",
    },
  });

  const transfers: ParkingTransferInput[] = txRows.map((r) => ({
    chain: prismaToChainSlug(r.chain),
    hash: r.hash,
    tokenAddress: (r.tokenAddress ?? "").toLowerCase() as Address,
    tokenSymbol: r.tokenSymbol,
    from: r.fromAddress as Address,
    to: r.toAddress ? (r.toAddress as Address) : null,
    amountRaw: r.amountRaw,
    amountUsd: r.amountUsd?.toString() ?? null,
    timestamp: r.timestamp,
  }));

  // Load latest balance snapshots
  const snapshots = await prisma.balanceSnapshot.findMany({
    where: {
      walletAddress: normalizedWallet,
      isStable: true,
    },
    orderBy: {
      timestamp: "desc",
    },
  });

  // Keep latest snapshot per (chain, tokenAddress)
  const latestByToken = new Map<string, typeof snapshots[0]>();
  for (const s of snapshots) {
    const key = `${s.chain}:${s.tokenAddress}`;
    if (!latestByToken.has(key)) {
      latestByToken.set(key, s);
    }
  }

  const balances: ParkingBalanceInput[] = Array.from(latestByToken.values()).map((s) => ({
    chain: prismaToChainSlug(s.chain),
    tokenAddress: (s.tokenAddress ?? "").toLowerCase() as Address,
    symbol: "STABLE",
    balanceRaw: s.balanceRaw,
    balanceUsd: s.balanceUsd?.toString() ?? null,
  }));

  // Load entity labels
  const entityRows = await prisma.entityLabel.findMany();
  const entityLabels: Record<string, string> = {};
  for (const e of entityRows) {
    entityLabels[e.address.toLowerCase()] = e.name;
  }

  return computeParkingFromTransfers({
    walletAddress: address,
    transfers,
    balances,
    stableTokensMap,
    entityLabels,
  });
}
