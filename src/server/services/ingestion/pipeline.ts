import type { Address, ChainSlug, ChainAdapter } from "@/lib/chains/types";
import type { PrismaClient } from "@/generated/prisma/client";
import { isEnsName, resolveWalletInput } from "@/server/services/wallet/ens";
import { fetchAllEndpointTransactions } from "./fetch";
import { persistTransactions } from "./persist";
import { persistWalletProfile } from "@/server/services/wallet/profile";
import { buildFundingTree } from "@/server/services/funding/trace";
import { detectAndSyncClusters } from "@/server/services/cluster/detect";
import { chainSlugToPrisma } from "@/server/services/wallet/normalize";

export const INTAKE_STAGES = [
  "resolve:ens",
  "fetch:normal",
  "fetch:internal",
  "fetch:erc20",
  "persist:tx",
  "price:events",
  "profile:stats",
  "funding:trace",
  "cluster:detect",
  "derive:movements",
  "derive:positions",
  "derive:relations",
  "alert:backfill",
  "done",
] as const;

export type IntakeStage = (typeof INTAKE_STAGES)[number];

export interface WalletIntakeInput {
  address: Address;
  chain: ChainSlug;
  requestedBy: "USER" | "IMPORT";
  importBatchId?: string;
  forceFullResync?: boolean;
}

export interface WalletIntakeResult {
  ok: boolean;
  durationMs: number;
  callsSpent: number;
  warnings: string[];
  address: string;
  chain: ChainSlug;
  txPersisted: number;
  movementsCreated: number;
  fundingEdges: number;
  primaryWalletsFound: number;
  clustersJoined: string[];
  alertsBackfilled: number;
  pricedCount: number;
  unknownUsdCount: number;
}

export interface IntakePipelineDeps {
  adapter: ChainAdapter;
  prisma?: PrismaClient;
  syncStateRepo?: {
    markFailed: (addr: string, chain: string, err: string) => Promise<void>;
    markCompleted?: (addr: string, chain: string) => Promise<void>;
  };
  onProgress?: (p: { stage: IntakeStage; progress: number }) => void | Promise<void>;
}

export async function runWalletIntakePipeline(
  input: WalletIntakeInput,
  deps: IntakePipelineDeps
): Promise<WalletIntakeResult> {
  const startTime = Date.now();
  const { address, chain, forceFullResync } = input;
  const { adapter, prisma, syncStateRepo, onProgress } = deps;

  let callsSpent = 0;
  let txPersistedCount = 0;
  let fundingEdgesCount = 0;
  let clustersJoined: string[] = [];

  const updateStage = async (stage: IntakeStage, index: number) => {
    if (onProgress) {
      const progress = Math.round(((index + 1) / INTAKE_STAGES.length) * 100);
      await onProgress({ stage, progress });
    }
  };

  try {
    // Stage 1: resolve:ens
    await updateStage("resolve:ens", 0);
    let resolvedAddress = address;
    if (isEnsName(address)) {
      const ensRes = await resolveWalletInput({ addressOrName: address, chain });
      resolvedAddress = ensRes.address as Address;
    }

    const fromBlock = forceFullResync ? 0n : 0n;

    // Stage 2: fetch:normal
    await updateStage("fetch:normal", 1);
    const normalFetch = await adapter.getTransactions(resolvedAddress, {
      fromBlock,
      toBlock: "latest",
    });
    callsSpent += normalFetch.callsSpent;

    // Stage 3: fetch:internal
    await updateStage("fetch:internal", 2);
    const internalFetch = await adapter.getInternalTxs(resolvedAddress, {
      fromBlock,
      toBlock: "latest",
    });
    callsSpent += internalFetch.callsSpent;

    // Stage 4: fetch:erc20
    await updateStage("fetch:erc20", 3);
    const erc20Fetch = await adapter.getTokenTransfers(resolvedAddress, {
      fromBlock,
      toBlock: "latest",
    });
    callsSpent += erc20Fetch.callsSpent;

    // Stage 5: persist:tx
    await updateStage("persist:tx", 4);
    txPersistedCount =
      normalFetch.records.length + internalFetch.records.length + erc20Fetch.records.length;

    if (prisma) {
      const fullFetch = await fetchAllEndpointTransactions(adapter, resolvedAddress, {
        nativeOpts: { fromBlock, toBlock: "latest" },
        internalOpts: { fromBlock, toBlock: "latest" },
        erc20Opts: { fromBlock, toBlock: "latest" },
      });

      const res1 = await persistTransactions({
        prisma,
        walletAddress: resolvedAddress,
        chain,
        transactions: fullFetch.native.transactions,
        tokenStubs: [],
        coveredThroughBlock: fullFetch.native.coveredThroughBlock,
        endpoint: "NORMAL_TX",
      });
      const res2 = await persistTransactions({
        prisma,
        walletAddress: resolvedAddress,
        chain,
        transactions: fullFetch.internal.transactions,
        tokenStubs: [],
        coveredThroughBlock: fullFetch.internal.coveredThroughBlock,
        endpoint: "INTERNAL_TX",
      });
      const res3 = await persistTransactions({
        prisma,
        walletAddress: resolvedAddress,
        chain,
        transactions: fullFetch.erc20.transactions,
        tokenStubs: fullFetch.erc20.tokenStubs,
        coveredThroughBlock: fullFetch.erc20.coveredThroughBlock,
        endpoint: "ERC20_TRANSFER",
      });
      txPersistedCount = res1.total + res2.total + res3.total;
    }

    // Stage 6: price:events
    await updateStage("price:events", 5);

    // Stage 7: profile:stats
    await updateStage("profile:stats", 6);
    if (prisma) {
      await persistWalletProfile(prisma, {
        walletAddress: resolvedAddress,
        chain,
        timezone: "UTC",
        stableTokens: [],
      });
    }

    // Stage 8: funding:trace
    await updateStage("funding:trace", 7);
    const traceRes = await buildFundingTree(
      {
        rootAddress: resolvedAddress,
        rootChain: chain,
        maxDepth: 3,
        mode: "DEFAULT",
      },
      {
        adapter,
        entities: {
          isTerminal: async () => null,
          getEntityLabel: async () => null,
        },
        prisma,
      }
    );
    callsSpent += traceRes.callsSpent;
    fundingEdgesCount = traceRes.nodesExpanded;

    // Stage 9: cluster:detect
    await updateStage("cluster:detect", 8);
    if (prisma) {
      const detected = await detectAndSyncClusters(prisma);
      clustersJoined = detected.map((c) => c.name);
    }

    // Stage 10: derive:movements (Phase 1 stub)
    await updateStage("derive:movements", 9);

    // Stage 11: derive:positions (Phase 1 stub)
    await updateStage("derive:positions", 10);

    // Stage 12: derive:relations (Phase 1 stub)
    await updateStage("derive:relations", 11);

    // Stage 13: alert:backfill (Phase 1 stub)
    await updateStage("alert:backfill", 12);

    // Stage 14: done
    await updateStage("done", 13);

    if (syncStateRepo?.markCompleted) {
      await syncStateRepo.markCompleted(resolvedAddress, chain);
    }

    return {
      ok: true,
      durationMs: Date.now() - startTime,
      callsSpent,
      warnings: [],
      address: resolvedAddress,
      chain,
      txPersisted: txPersistedCount,
      movementsCreated: 0,
      fundingEdges: fundingEdgesCount,
      primaryWalletsFound: 0,
      clustersJoined,
      alertsBackfilled: 0,
      pricedCount: 0,
      unknownUsdCount: 0,
    };
  } catch (err: any) {
    if (syncStateRepo?.markFailed) {
      await syncStateRepo.markFailed(address, chain, err.message || String(err));
    }
    throw err;
  }
}
