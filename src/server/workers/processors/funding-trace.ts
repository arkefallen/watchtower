import type { Job } from "bullmq";
import { prisma as defaultPrisma } from "@/server/db/client";
import type { ChainSlug, Address, ChainAdapter } from "@/lib/chains/types";
import { buildFundingTree, type EntityService } from "@/server/services/funding/trace";
import { getAdapter } from "@/lib/chains/registry";
import { createNativePriceStore } from "@/server/services/pricing/native";
import { chainSlugToPrisma } from "@/server/services/wallet/normalize";

export interface FundingTraceJobData {
  walletAddress: string;
  chain: ChainSlug;
  maxDepth?: number;
  mode?: "DEFAULT" | "DEEP";
  branchAddress?: string;
  callBudget?: number;
}

export async function processFundingTraceJob(
  job: Job<FundingTraceJobData>,
  injectedPrisma = defaultPrisma,
  adapterFactory?: (chain: ChainSlug) => ChainAdapter
) {
  const { walletAddress, chain, maxDepth = 3, mode = "DEFAULT", branchAddress, callBudget = 100 } =
    job.data;
  const prisma = injectedPrisma;

  const adapter = adapterFactory ? adapterFactory(chain) : getAdapter(chain);
  const nativePriceStore = createNativePriceStore(prisma);
  const nativePriceSnapshot = await nativePriceStore.nearest(chain, new Date());

  const entities: EntityService = {
    isTerminal: async (addr: Address) => {
      const label = await prisma.entityLabel.findFirst({
        where: {
          address: addr.toLowerCase(),
          chain: chainSlugToPrisma(chain),
        },
      });
      if (label && (label.kind === "CEX" || label.kind === "BRIDGE" || label.kind === "ROUTER")) {
        return { name: label.name, kind: label.kind };
      }
      return null;
    },
    getEntityLabel: async (addr: Address) => {
      const label = await prisma.entityLabel.findFirst({
        where: {
          address: addr.toLowerCase(),
          chain: chainSlugToPrisma(chain),
        },
      });
      if (label) {
        return { name: label.name, kind: label.kind };
      }
      return null;
    },
  };

  const result = await buildFundingTree(
    {
      rootAddress: walletAddress.toLowerCase() as Address,
      rootChain: chain,
      maxDepth,
      mode,
      branch: branchAddress
        ? { address: branchAddress.toLowerCase() as Address, chain }
        : undefined,
      callBudget,
      onProgress: async (p) => {
        if (job.updateProgress) {
          await job.updateProgress(p.progress);
        }
      },
    },
    {
      adapter,
      entities,
      nativePriceUsd: nativePriceSnapshot?.priceUsd ?? null,
      prisma,
    }
  );

  return {
    rootAddress: walletAddress,
    rootChain: chain,
    nodesExpanded: result.nodesExpanded,
    callsSpent: result.callsSpent,
    truncated: result.truncated,
  };
}
