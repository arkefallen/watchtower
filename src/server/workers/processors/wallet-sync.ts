import type { Job } from "bullmq";
import type { PrismaClient } from "@/generated/prisma/client";
import type { ChainSlug, Address, ChainAdapter } from "@/lib/chains/types";
import { syncWalletIncremental, type IncrementalSyncResult } from "@/server/services/ingestion/incremental";
import { getAdapter } from "@/lib/chains/registry";
import { persistWalletProfile } from "@/server/services/wallet/profile";
import { loadSettings } from "@/server/services/settings";

export interface WalletSyncJobData {
  address: string;
  chain: ChainSlug;
  reason: "SCHEDULED" | "USER" | "RETRY";
  forceFullResync?: boolean;
}

export async function processWalletSyncJob(
  job: Job<WalletSyncJobData>,
  injectedPrisma?: PrismaClient,
  adapterFactory?: (chain: ChainSlug) => ChainAdapter
): Promise<IncrementalSyncResult> {
  const { address, chain, forceFullResync } = job.data;
  const prisma = injectedPrisma ?? (await import("@/server/db/client")).prisma;
  const adapter = adapterFactory ? adapterFactory(chain) : getAdapter(chain);

  if (job.updateProgress) {
    await job.updateProgress(10);
  }

  const result = await syncWalletIncremental(
    {
      address: address.toLowerCase() as Address,
      chain,
      forceFullResync,
    },
    {
      adapter,
      prisma,
    }
  );

  if (job.updateProgress) {
    await job.updateProgress(70);
  }

  // If new transactions were ingested, refresh profile stats
  if (result.newTx > 0) {
    const settings = await loadSettings();
    const stableTokens = Object.values(settings.stableTokens ?? {})
      .flat()
      .map((t: { address: string }) => t.address.toLowerCase());

    await persistWalletProfile(prisma, {
      walletAddress: address.toLowerCase() as Address,
      chain,
      timezone: "UTC",
      stableTokens,
    });
  }

  if (job.updateProgress) {
    await job.updateProgress(100);
  }

  return result;
}
