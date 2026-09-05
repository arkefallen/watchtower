import { formatUnits } from "viem";
import type { Address, ChainSlug, ChainAdapter, RawBalance } from "@/lib/chains/types";
import type { PrismaClient, Chain } from "@/generated/prisma/client";
import { chainSlugToPrisma } from "../wallet/normalize";

export interface BalancePricingContext {
  getNativePriceUsd: (chain: ChainSlug, at: Date) => Promise<string | null>;
  getStableUsd?: (
    tokenAddress: Address,
    balanceRaw: string,
    decimals: number | null
  ) => Promise<string | null>;
}

export interface BalanceSnapshotInput {
  walletAddress: Address;
  chain: ChainSlug;
  adapter: ChainAdapter;
  stableTokens: Address[];
  pricing: BalancePricingContext;
  timestamp?: Date;
  prisma?: PrismaClient;
}

export interface ComputedSnapshot {
  walletAddress: Address;
  chain: ChainSlug;
  tokenAddress: Address | null;
  timestamp: Date;
  balanceRaw: string;
  balanceUsd: string | null;
  isStable: boolean;
}

export interface TakeBalanceSnapshotsResult {
  snapshots: ComputedSnapshot[];
  stableBalanceUsd: string;
  nativeBalanceRaw: string;
  nativeBalanceUsd: string | null;
}

export async function takeBalanceSnapshots(
  input: BalanceSnapshotInput
): Promise<TakeBalanceSnapshotsResult> {
  const { walletAddress, chain, adapter, stableTokens, pricing, timestamp = new Date(), prisma } = input;

  // Hour-truncated timestamp for deduplication and idempotency
  const hourTruncated = new Date(Math.floor(timestamp.getTime() / (3600 * 1000)) * (3600 * 1000));
  const stableSet = new Set(stableTokens.map((t) => t.toLowerCase()));

  // Query balances for native + configured stable addresses
  const rawBalances = await adapter.getBalances(walletAddress, stableTokens);

  // Price native asset
  const nativePriceUsd = await pricing.getNativePriceUsd(chain, hourTruncated);

  const snapshots: ComputedSnapshot[] = [];
  let nativeBalanceRaw = "0";
  let nativeBalanceUsd: string | null = null;
  let totalStableUsd = 0;

  for (const raw of rawBalances) {
    if (raw.tokenAddress === null) {
      // Native asset
      nativeBalanceRaw = raw.balanceRaw;
      let usdVal: string | null = null;
      if (nativePriceUsd !== null) {
        try {
          const decimals = raw.decimals ?? adapter.nativeDecimals ?? 18;
          const units = formatUnits(BigInt(raw.balanceRaw), decimals);
          const val = parseFloat(units) * parseFloat(nativePriceUsd);
          usdVal = val.toFixed(8);
          nativeBalanceUsd = usdVal;
        } catch {
          usdVal = null;
        }
      }

      snapshots.push({
        walletAddress,
        chain,
        tokenAddress: null,
        timestamp: hourTruncated,
        balanceRaw: raw.balanceRaw,
        balanceUsd: usdVal,
        isStable: false,
      });
    } else {
      // Token balance - only include if configured stable
      const tokenLower = raw.tokenAddress.toLowerCase() as Address;
      if (!stableSet.has(tokenLower)) {
        continue;
      }

      let usdVal: string | null = null;
      if (pricing.getStableUsd) {
        usdVal = await pricing.getStableUsd(tokenLower, raw.balanceRaw, raw.decimals);
      } else if (raw.decimals != null) {
        try {
          // Stables are valued at par $1.00
          const units = formatUnits(BigInt(raw.balanceRaw), raw.decimals);
          const val = parseFloat(units);
          usdVal = val.toFixed(8);
        } catch {
          usdVal = null;
        }
      }

      if (usdVal !== null) {
        totalStableUsd += parseFloat(usdVal);
      }

      snapshots.push({
        walletAddress,
        chain,
        tokenAddress: tokenLower,
        timestamp: hourTruncated,
        balanceRaw: raw.balanceRaw,
        balanceUsd: usdVal,
        isStable: true,
      });
    }
  }

  const stableBalanceUsd = totalStableUsd.toFixed(8);

  // Persist if prisma client is provided
  if (prisma) {
    const prismaChain = chainSlugToPrisma(chain);
    const normalizedWallet = walletAddress.toLowerCase();

    for (const snap of snapshots) {
      const tokenAddressVal = snap.tokenAddress ? snap.tokenAddress.toLowerCase() : null;

      // In Postgres, unique index with nullable column: Prisma allows findFirst or compound unique
      const existing = await prisma.balanceSnapshot.findFirst({
        where: {
          walletAddress: normalizedWallet,
          chain: prismaChain,
          tokenAddress: tokenAddressVal,
          timestamp: hourTruncated,
        },
      });

      if (existing) {
        await prisma.balanceSnapshot.update({
          where: { id: existing.id },
          data: {
            balanceRaw: snap.balanceRaw,
            balanceUsd: snap.balanceUsd,
            isStable: snap.isStable,
          },
        });
      } else {
        await prisma.balanceSnapshot.create({
          data: {
            walletAddress: normalizedWallet,
            chain: prismaChain,
            tokenAddress: tokenAddressVal,
            timestamp: hourTruncated,
            balanceRaw: snap.balanceRaw,
            balanceUsd: snap.balanceUsd,
            isStable: snap.isStable,
          },
        });
      }
    }

    // Update WalletProfile
    await prisma.walletProfile.upsert({
      where: {
        walletAddress_walletChain: {
          walletAddress: normalizedWallet,
          walletChain: prismaChain,
        },
      },
      create: {
        walletAddress: normalizedWallet,
        walletChain: prismaChain,
        stableBalanceUsd,
        nativeBalanceRaw,
        nativeBalanceUsd,
        heatmapJson: { habitual: [], recent7d: [], timezone: "UTC", recentWindow: { start: "", end: "" } },
      },
      update: {
        stableBalanceUsd,
        nativeBalanceRaw,
        nativeBalanceUsd,
      },
    });

    // Update cluster combinedStableUsd if this wallet belongs to any cluster
    const clusterMemberships = await prisma.clusterMember.findMany({
      where: {
        walletAddress: normalizedWallet,
        walletChain: prismaChain,
      },
      select: { clusterId: true },
    });

    for (const { clusterId } of clusterMemberships) {
      const allMembers = await prisma.clusterMember.findMany({
        where: { clusterId },
        select: { walletAddress: true, walletChain: true },
      });

      let clusterTotalStable = 0;
      for (const m of allMembers) {
        const prof = await prisma.walletProfile.findUnique({
          where: {
            walletAddress_walletChain: {
              walletAddress: m.walletAddress,
              walletChain: m.walletChain,
            },
          },
          select: { stableBalanceUsd: true },
        });
        if (prof?.stableBalanceUsd) {
          clusterTotalStable += parseFloat(prof.stableBalanceUsd.toString());
        }
      }

      await prisma.cluster.update({
        where: { id: clusterId },
        data: {
          combinedStableUsd: clusterTotalStable.toFixed(8),
        },
      });
    }
  }

  return {
    snapshots,
    stableBalanceUsd,
    nativeBalanceRaw,
    nativeBalanceUsd,
  };
}
