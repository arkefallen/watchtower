import { describe, expect, it, vi } from "vitest";
import {
  syncWalletIncremental,
  type IncrementalSyncDeps,
} from "@/server/services/ingestion/incremental";
import {
  selectDueWallets,
  processScheduleSyncTick,
  type WalletSchedulerRow,
} from "@/server/workers/processors/schedule-sync-tick";
import type { Address, ChainAdapter, RawNativeTx } from "@/lib/chains/types";

describe("P1-T16: Incremental Sync and Sync Scheduler", () => {
  const sampleWallet = "0x1111111111111111111111111111111111111111" as Address;

  const createMockAdapter = (latestBlock: bigint = 200n): ChainAdapter & { requestedBlocks: Record<string, bigint> } => {
    const requestedBlocks: Record<string, bigint> = {};
    return {
      chain: "base",
      chainId: 8453,
      nativeSymbol: "ETH",
      nativeDecimals: 18,
      requestedBlocks,
      getTransactions: async (_addr: Address, opts: any) => {
        requestedBlocks["normal"] = opts.fromBlock;
        return {
          records: [],
          coveredThroughBlock: latestBlock,
          truncated: false,
          pages: [],
          callsSpent: 1,
        };
      },
      getInternalTxs: async (_addr: Address, opts: any) => {
        requestedBlocks["internal"] = opts.fromBlock;
        return {
          records: [],
          coveredThroughBlock: latestBlock,
          truncated: false,
          pages: [],
          callsSpent: 1,
        };
      },
      getTokenTransfers: async (_addr: Address, opts: any) => {
        requestedBlocks["erc20"] = opts.fromBlock;
        return {
          records: [],
          coveredThroughBlock: latestBlock,
          truncated: false,
          pages: [],
          callsSpent: 1,
        };
      },
      getLatestBlock: async () => latestBlock,
    } as unknown as ChainAdapter & { requestedBlocks: Record<string, bigint> };
  };

  it("sync: only blocks above the cursor are requested", async () => {
    const adapter = createMockAdapter(200n);
    const existingCursors = {
      NORMAL_TX: { coveredThroughBlock: "150", highestBlockSeen: "150" },
      INTERNAL_TX: { coveredThroughBlock: "120", highestBlockSeen: "120" },
      ERC20_TRANSFER: { coveredThroughBlock: "180", highestBlockSeen: "180" },
    };

    let updatedCursors: any = null;

    await syncWalletIncremental(
      {
        address: sampleWallet,
        chain: "base",
      },
      {
        adapter,
        getCursors: async () => existingCursors,
        saveCursors: async (_addr, _ch, cursors) => {
          updatedCursors = cursors;
        },
      }
    );

    expect(adapter.requestedBlocks["normal"]).toBe(151n);
    expect(adapter.requestedBlocks["internal"]).toBe(121n);
    expect(adapter.requestedBlocks["erc20"]).toBe(181n);
  });

  it("sync: cursor is unchanged when the fetch fails", async () => {
    const adapter = createMockAdapter(200n);
    adapter.getTransactions = async () => {
      throw new Error("RPC error during fetch");
    };

    const existingCursors = {
      NORMAL_TX: { coveredThroughBlock: "150", highestBlockSeen: "150" },
    };

    let saveCalled = false;

    await expect(
      syncWalletIncremental(
        {
          address: sampleWallet,
          chain: "base",
        },
        {
          adapter,
          getCursors: async () => existingCursors,
          saveCursors: async () => {
            saveCalled = true;
          },
        }
      )
    ).rejects.toThrow(/RPC error/);

    expect(saveCalled).toBe(false);
  });

  it("sync: full re-sync requires the explicit flag", async () => {
    const adapter = createMockAdapter(200n);
    const existingCursors = {
      NORMAL_TX: { coveredThroughBlock: "150", highestBlockSeen: "150" },
      INTERNAL_TX: { coveredThroughBlock: "150", highestBlockSeen: "150" },
      ERC20_TRANSFER: { coveredThroughBlock: "150", highestBlockSeen: "150" },
    };

    await syncWalletIncremental(
      {
        address: sampleWallet,
        chain: "base",
        forceFullResync: true,
      },
      {
        adapter,
        getCursors: async () => existingCursors,
        saveCursors: async () => {},
      }
    );

    expect(adapter.requestedBlocks["normal"]).toBe(0n);
    expect(adapter.requestedBlocks["internal"]).toBe(0n);
    expect(adapter.requestedBlocks["erc20"]).toBe(0n);
  });

  it("scheduler: HIGH-priority wallets are selected before NORMAL", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const wallets: WalletSchedulerRow[] = [
      {
        address: "0xnormal1",
        chain: "base",
        watchPriority: "NORMAL",
        lastSyncedAt: new Date("2026-01-01T10:00:00Z"),
      },
      {
        address: "0xhigh1",
        chain: "base",
        watchPriority: "HIGH",
        lastSyncedAt: new Date("2026-01-01T11:00:00Z"),
      },
      {
        address: "0xnormal2",
        chain: "base",
        watchPriority: "NORMAL",
        lastSyncedAt: new Date("2026-01-01T09:00:00Z"),
      },
    ];

    const due = selectDueWallets(wallets, 15, now);
    expect(due[0].address).toBe("0xhigh1"); // HIGH priority selected first
  });

  it("scheduler: respects syncCadenceMinutes", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const wallets: WalletSchedulerRow[] = [
      {
        address: "0xrecent",
        chain: "base",
        watchPriority: "NORMAL",
        lastSyncedAt: new Date("2026-01-01T11:55:00Z"), // 5 mins ago (< 15 mins)
      },
      {
        address: "0xdue",
        chain: "base",
        watchPriority: "NORMAL",
        lastSyncedAt: new Date("2026-01-01T11:30:00Z"), // 30 mins ago (>= 15 mins)
      },
      {
        address: "0xneversynced",
        chain: "base",
        watchPriority: "NORMAL",
        lastSyncedAt: null, // never synced
      },
    ];

    const due = selectDueWallets(wallets, 15, now);
    const addresses = due.map((w) => w.address);
    expect(addresses).toContain("0xdue");
    expect(addresses).toContain("0xneversynced");
    expect(addresses).not.toContain("0xrecent");
  });

  it("scheduler: skips enqueueing when the budget is exhausted", async () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const wallets: WalletSchedulerRow[] = [
      {
        address: "0xdue1",
        chain: "base",
        watchPriority: "HIGH",
        lastSyncedAt: null,
      },
    ];

    const mockQueue = {
      enqueued: [] as string[],
      add: async (name: string, data: any) => {
        mockQueue.enqueued.push(data.address);
      },
    };

    const exhaustedBudgetGuard = {
      acquire: async () => {
        throw new Error("Budget exhausted");
      },
      hasBudget: async () => false,
    };

    const result = await processScheduleSyncTick({
      wallets,
      syncCadenceMinutes: 15,
      now,
      queue: mockQueue as any,
      budgetGuard: exhaustedBudgetGuard,
    });

    expect(result.enqueued).toBe(0);
    expect(result.skippedForBudget).toBe(1);
    expect(mockQueue.enqueued).toHaveLength(0);
  });
});
