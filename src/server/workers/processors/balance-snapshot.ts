import type { Job } from "bullmq";
import { prisma as defaultPrisma } from "@/server/db/client";
import type { ChainSlug, Address, ChainAdapter } from "@/lib/chains/types";
import { takeBalanceSnapshots } from "@/server/services/pricing/balances";
import { createNativePriceStore } from "@/server/services/pricing/native";
import { loadSettings } from "@/server/services/settings";
import { prismaToChainSlug } from "@/server/services/wallet/normalize";
import { getAdapter } from "@/lib/chains/registry";

export interface BalanceSnapshotPayload {
  addresses?: Array<{ address: string; chain: ChainSlug }>;
  tokens?: "STABLES" | "STABLES_AND_NATIVE";
}

export interface BalanceSnapshotResult {
  snapshots: number;
  walletsCovered: number;
}

export async function processBalanceSnapshotJob(
  job: Job<BalanceSnapshotPayload>,
  injectedPrisma = defaultPrisma,
  adapterFactory?: (chain: ChainSlug) => ChainAdapter
): Promise<BalanceSnapshotResult> {
  const prisma = injectedPrisma;
  const settings = await loadSettings();
  const nativePriceStore = createNativePriceStore(prisma);

  let targetWallets: Array<{ address: string; chain: ChainSlug }> = [];

  if (job.data.addresses && job.data.addresses.length > 0) {
    targetWallets = job.data.addresses;
  } else {
    // Find all active wallets in DB
    const allWallets = await prisma.wallet.findMany({
      select: { address: true, chain: true },
    });
    targetWallets = allWallets.map((w) => ({
      address: w.address,
      chain: prismaToChainSlug(w.chain),
    }));
  }

  let totalSnapshots = 0;
  let walletsCovered = 0;

  for (let i = 0; i < targetWallets.length; i++) {
    const target = targetWallets[i];
    const chain = target.chain;
    const adapter = adapterFactory ? adapterFactory(chain) : getAdapter(chain);

    const configuredStables = (settings.stableTokens?.[chain] ?? []).map(
      (s: { address: string }) => s.address.toLowerCase() as Address
    );

    const result = await takeBalanceSnapshots({
      walletAddress: target.address.toLowerCase() as Address,
      chain,
      adapter,
      stableTokens: configuredStables,
      pricing: {
        getNativePriceUsd: async (c, at) => {
          const nearest = await nativePriceStore.nearest(c, at);
          return nearest?.priceUsd ?? null;
        },
      },
      prisma,
    });

    totalSnapshots += result.snapshots.length;
    walletsCovered++;

    if (job.updateProgress) {
      await job.updateProgress(Math.round(((i + 1) / targetWallets.length) * 100));
    }
  }

  return {
    snapshots: totalSnapshots,
    walletsCovered,
  };
}
