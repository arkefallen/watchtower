import { describe, expect, it, vi } from "vitest";
import {
  runWalletIntakePipeline,
  INTAKE_STAGES,
  type IntakePipelineDeps,
  type WalletIntakeInput,
} from "@/server/services/ingestion/pipeline";
import type { Address, ChainAdapter, RawNativeTx, RawInternalTx, RawTokenTransfer } from "@/lib/chains/types";

describe("P1-T15: Intake Pipeline Orchestration", () => {
  const wallet = "0x1111111111111111111111111111111111111111" as Address;
  const funder = "0x2222222222222222222222222222222222222222" as Address;

  const createMockAdapter = (failOn?: string): ChainAdapter => ({
    chain: "base",
    chainId: 8453,
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    getTransactions: async () => {
      if (failOn === "normal") throw new Error("Adapter normal tx fetch failed");
      return {
        records: [
          {
            hash: "0x1",
            blockNumber: 10n,
            timestamp: new Date("2026-01-01T00:00:00Z"),
            from: funder,
            to: wallet,
            valueRaw: "1000000000000000000",
            gasUsed: null,
            gasPriceWei: null,
            isError: false,
            methodId: null,
            functionName: null,
            contractCreated: null,
          },
        ],
        coveredThroughBlock: 100n,
        truncated: false,
        pages: [],
        callsSpent: 1,
      };
    },
    getInternalTxs: async () => ({
      records: [],
      coveredThroughBlock: 100n,
      truncated: false,
      pages: [],
      callsSpent: 1,
    }),
    getTokenTransfers: async () => ({
      records: [],
      coveredThroughBlock: 100n,
      truncated: false,
      pages: [],
      callsSpent: 1,
    }),
    getTokenInfo: async () => null,
    getBalances: async () => [],
    getLatestBlock: async () => 100n,
    getBlockNumberByTimestamp: async () => 1n,
    getTokenHolderSummary: async () => null,
    explorerTxUrl: (h: string) => `https://basescan.org/tx/${h}`,
    explorerAddressUrl: (a: string) => `https://basescan.org/address/${a}`,
  });

  it("intake: stages execute in the declared order", async () => {
    const executedStages: string[] = [];
    const progressUpdates: number[] = [];

    const adapter = createMockAdapter();
    const result = await runWalletIntakePipeline(
      {
        address: wallet,
        chain: "base",
        requestedBy: "USER",
      },
      {
        adapter,
        onProgress: async (p) => {
          executedStages.push(p.stage);
          progressUpdates.push(p.progress);
        },
      }
    );

    expect(executedStages).toEqual([...INTAKE_STAGES]);
    expect(result.ok).toBe(true);
  });

  it("intake: progress is monotonic and ends at 100", async () => {
    const progressUpdates: number[] = [];
    const adapter = createMockAdapter();

    await runWalletIntakePipeline(
      {
        address: wallet,
        chain: "base",
        requestedBy: "USER",
      },
      {
        adapter,
        onProgress: async (p) => {
          progressUpdates.push(p.progress);
        },
      }
    );

    expect(progressUpdates.length).toBeGreaterThan(0);
    for (let i = 1; i < progressUpdates.length; i++) {
      expect(progressUpdates[i]).toBeGreaterThanOrEqual(progressUpdates[i - 1]);
    }
    expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
  });

  it("intake: adapter failure marks SyncState FAILED with lastError", async () => {
    const adapter = createMockAdapter("normal");
    let recordedError: string | null = null;
    let recordedStatus: string | null = null;

    const mockSyncStateRepo = {
      markFailed: async (addr: string, chain: string, err: string) => {
        recordedError = err;
        recordedStatus = "FAILED";
      },
      markCompleted: async () => {},
    };

    await expect(
      runWalletIntakePipeline(
        {
          address: wallet,
          chain: "base",
          requestedBy: "USER",
        },
        {
          adapter,
          syncStateRepo: mockSyncStateRepo,
        }
      )
    ).rejects.toThrow(/Adapter normal tx fetch failed/);

    expect(recordedStatus).toBe("FAILED");
    expect(recordedError).toContain("Adapter normal tx fetch failed");
  });

  it("intake: result reports counts for tx, movements, funding edges, clusters", async () => {
    const adapter = createMockAdapter();

    const result = await runWalletIntakePipeline(
      {
        address: wallet,
        chain: "base",
        requestedBy: "USER",
      },
      {
        adapter,
      }
    );

    expect(result.address).toBe(wallet);
    expect(result.chain).toBe("base");
    expect(result.txPersisted).toBeGreaterThanOrEqual(1);
    expect(result).toHaveProperty("movementsCreated");
    expect(result).toHaveProperty("fundingEdges");
    expect(result).toHaveProperty("clustersJoined");
  });

  it("intake: forceFullResync re-fetches from block 0", async () => {
    let requestedFromBlock: bigint | null = null;
    const adapter = createMockAdapter();
    adapter.getTransactions = async (_addr, opts) => {
      requestedFromBlock = opts.fromBlock;
      return {
        records: [],
        coveredThroughBlock: 100n,
        truncated: false,
        pages: [],
        callsSpent: 1,
      };
    };

    await runWalletIntakePipeline(
      {
        address: wallet,
        chain: "base",
        requestedBy: "USER",
        forceFullResync: true,
      },
      {
        adapter,
      }
    );

    expect(requestedFromBlock).toBe(0n);
  });
});
