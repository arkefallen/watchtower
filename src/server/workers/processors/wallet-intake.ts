import type { Job } from "bullmq";
import { prisma as defaultPrisma } from "@/server/db/client";
import type { ChainSlug, Address, ChainAdapter } from "@/lib/chains/types";
import { runWalletIntakePipeline, type WalletIntakeResult } from "@/server/services/ingestion/pipeline";
import { getAdapter } from "@/lib/chains/registry";
import { chainSlugToPrisma } from "@/server/services/wallet/normalize";
import { SyncStatus } from "@/generated/prisma/client";

export interface WalletIntakeJobData {
  address: string;
  chain: ChainSlug;
  requestedBy: "USER" | "IMPORT";
  importBatchId?: string;
  forceFullResync?: boolean;
}

export async function processWalletIntakeJob(
  job: Job<WalletIntakeJobData>,
  injectedPrisma = defaultPrisma,
  adapterFactory?: (chain: ChainSlug) => ChainAdapter
): Promise<WalletIntakeResult> {
  const prisma = injectedPrisma;
  const { address, chain, requestedBy, importBatchId, forceFullResync } = job.data;
  const adapter = adapterFactory ? adapterFactory(chain) : getAdapter(chain);

  const prismaChain = chainSlugToPrisma(chain);
  const normAddress = address.toLowerCase();

  // Mark SyncState IN_PROGRESS
  await prisma.syncState.upsert({
    where: {
      walletAddress_chain: {
        walletAddress: normAddress,
        chain: prismaChain,
      },
    },
    create: {
      walletAddress: normAddress,
      chain: prismaChain,
      status: SyncStatus.RUNNING,
    },
    update: {
      status: SyncStatus.RUNNING,
      lastError: null,
    },
  });

  const syncStateRepo = {
    markFailed: async (addr: string, ch: string, err: string) => {
      await prisma.syncState.update({
        where: {
          walletAddress_chain: {
            walletAddress: addr.toLowerCase(),
            chain: chainSlugToPrisma(ch as ChainSlug),
          },
        },
        data: {
          status: SyncStatus.FAILED,
          lastError: err,
        },
      });
    },
    markCompleted: async (addr: string, ch: string) => {
      await prisma.syncState.update({
        where: {
          walletAddress_chain: {
            walletAddress: addr.toLowerCase(),
            chain: chainSlugToPrisma(ch as ChainSlug),
          },
        },
        data: {
          status: SyncStatus.IDLE,
          lastSyncedAt: new Date(),
          lastError: null,
        },
      });
    },
  };

  return runWalletIntakePipeline(
    {
      address: normAddress as Address,
      chain,
      requestedBy,
      importBatchId,
      forceFullResync,
    },
    {
      adapter,
      prisma,
      syncStateRepo,
      onProgress: async (p) => {
        if (job.updateProgress) {
          await job.updateProgress(p.progress);
        }
      },
    }
  );
}
