// src/server/workers/processors/self-link.ts
import type { Job } from "bullmq";
import { prisma as defaultPrisma } from "@/server/db/client";
import type { PrismaClient } from "@/generated/prisma/client";
import type { ChainSlug } from "@/lib/chains/types";
import { linkAllUserTrades } from "@/server/services/self/link";

export interface SelfLinkJobData {
  walletAddress: string;
  chain: ChainSlug;
}

export interface SelfLinkJobResult {
  walletAddress: string;
  chain: ChainSlug;
  total: number;
  linkedCount: number;
}

/**
 * BullMQ processor for 'self.link.trades' jobs.
 * Enqueued automatically after self-wallet ingestion to link newly recorded trades.
 */
export async function processSelfLinkJob(
  job: Job<SelfLinkJobData>,
  injectedPrisma: PrismaClient = defaultPrisma
): Promise<SelfLinkJobResult> {
  const { walletAddress, chain } = job.data;
  const result = await linkAllUserTrades(walletAddress, chain, injectedPrisma);

  return {
    walletAddress,
    chain,
    ...result,
  };
}
