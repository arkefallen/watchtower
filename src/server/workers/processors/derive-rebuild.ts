import type { PrismaClient, Chain } from "@/generated/prisma/client";
import { aggregateInteractionEdges } from "../../services/interaction/aggregate";
import { rebuildWalletRelations } from "../../services/independence/verdict";

export type DeriveTarget = "INTERACTION_EDGES" | "WALLET_RELATIONS" | "ALL";

export interface DeriveRebuildOptions {
  target: DeriveTarget;
  chain?: Chain;
  address?: string;
}

export interface DeriveRebuildResult {
  target: DeriveTarget;
  edgesAggregated?: number;
  tokensAggregated?: number;
  relationsRebuilt?: number;
}

/**
 * Processor for derive.rebuild BullMQ jobs and programmatic derivation maintenance.
 */
export async function processDeriveRebuild(
  prisma: PrismaClient,
  options: DeriveRebuildOptions
): Promise<DeriveRebuildResult> {
  const result: DeriveRebuildResult = { target: options.target };

  if (options.target === "INTERACTION_EDGES" || options.target === "ALL") {
    const edgeRes = await aggregateInteractionEdges(prisma, {
      chain: options.chain,
      address: options.address,
    });
    result.edgesAggregated = edgeRes.edgesCreatedOrUpdated;
    result.tokensAggregated = edgeRes.tokensCreatedOrUpdated;
  }

  if (options.target === "WALLET_RELATIONS" || options.target === "ALL") {
    const relRes = await rebuildWalletRelations(prisma, {
      chain: options.chain,
      address: options.address,
    });
    result.relationsRebuilt = relRes.rowsWritten;
  }

  return result;
}
