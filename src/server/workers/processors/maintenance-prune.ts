// src/server/workers/processors/maintenance-prune.ts
import type { PrismaClient } from "@/generated/prisma/client";
import { pruneTokenHistory, type PruneTokenHistoryResult } from "../../services/maintenance/prune";
import type { ChainSlug } from "@/lib/chains/types";

export interface MaintenancePrunePayload {
  tokenAddress: string;
  chain: ChainSlug;
  confirmation: string;
}

/**
 * BullMQ processor for asynchronous token history pruning (NFR-5, P6-T04).
 */
export async function processMaintenancePrune(
  prisma: PrismaClient,
  payload: MaintenancePrunePayload
): Promise<PruneTokenHistoryResult> {
  return pruneTokenHistory(
    {
      tokenAddress: payload.tokenAddress,
      chain: payload.chain,
      confirmation: payload.confirmation,
    },
    prisma
  );
}
