import { describe, expect, it, vi } from "vitest";
import {
  buildFundingTree,
  type FundingTraceInput,
  type FundingDeps,
  type EntityService,
} from "@/server/services/funding/trace";
import type { Address, ChainAdapter, RawNativeTx, RawInternalTx, RawTokenTransfer } from "@/lib/chains/types";

describe("P1-T09: Funding-Tree Builder", () => {
  const root = "0x1111111111111111111111111111111111111111" as Address;
  const funder1 = "0x2222222222222222222222222222222222222222" as Address;
  const funder2 = "0x3333333333333333333333333333333333333333" as Address;
  const binanceCex = "0x28c6c06298d514db089934071355e5743bf21d60".toLowerCase() as Address;
  const humanFunder = "0x4444444444444444444444444444444444444444" as Address;

  const createMockEntities = (terminals: Record<string, string> = {}): EntityService => ({
    isTerminal: async (addr: Address) => {
      const name = terminals[addr.toLowerCase()];
      if (name) {
        return { name, kind: "CEX" };
      }
      return null;
    },
    getEntityLabel: async (addr: Address) => {
      if (addr.toLowerCase() === humanFunder.toLowerCase()) {
        return { name: "Alice", kind: "HUMAN" };
      }
      const name = terminals[addr.toLowerCase()];
      if (name) {
        return { name, kind: "CEX" };
      }
      return null;
    },
  });

  const createMockAdapter = (data: {
    nativeTxs?: Record<string, RawNativeTx[]>;
    internalTxs?: Record<string, RawInternalTx[]>;
  }): ChainAdapter & { calls: Record<string, number> } => {
    const calls = { getTransactions: 0, getInternalTxs: 0 };
    return {
      chain: "base",
      chainId: 8453,
      nativeSymbol: "ETH",
      nativeDecimals: 18,
      calls,
      getTransactions: async (addr: Address) => {
        calls.getTransactions++;
        return {
          records: data.nativeTxs?.[addr.toLowerCase()] ?? [],
          coveredThroughBlock: 100n,
          truncated: false,
          pages: [],
          callsSpent: 1,
        };
      },
      getInternalTxs: async (addr: Address) => {
        calls.getInternalTxs++;
        return {
          records: data.internalTxs?.[addr.toLowerCase()] ?? [],
          coveredThroughBlock: 100n,
          truncated: false,
          pages: [],
          callsSpent: 1,
        };
      },
    } as unknown as ChainAdapter & { calls: Record<string, number> };
  };

  it("funding: internal-only funder appears in the tree", async () => {
    // Funder 1 sent ETH to root ONLY via internal transaction
    const internalTxs: Record<string, RawInternalTx[]> = {
      [root.toLowerCase()]: [
        {
          hash: "0xinternal1",
          traceId: "1",
          blockNumber: 10n,
          timestamp: new Date("2026-01-01T00:00:00Z"),
          from: funder1,
          to: root,
          valueRaw: "1000000000000000000", // 1 ETH
          isError: false,
          callType: "call",
        },
      ],
    };

    const adapter = createMockAdapter({ internalTxs });
    const entities = createMockEntities();

    const result = await buildFundingTree(
      { rootAddress: root, rootChain: "base", maxDepth: 3, mode: "DEFAULT", callBudget: 50 },
      {
        adapter,
        entities,
        nativePriceUsd: "2000.00",
      }
    );

    expect(result.root.children).toHaveLength(1);
    expect(result.root.children[0].address).toBe(funder1);
    expect(result.root.children[0].internalFundingCount).toBe(1);
    expect(result.root.children[0].fundingCount).toBe(1);
  });

  it("funding: terminal CEX funder is a leaf and no adapter call is made for its history", async () => {
    const nativeTxs: Record<string, RawNativeTx[]> = {
      [root.toLowerCase()]: [
        {
          hash: "0xcex1",
          blockNumber: 10n,
          timestamp: new Date("2026-01-01T00:00:00Z"),
          from: binanceCex,
          to: root,
          valueRaw: "2000000000000000000",
          gasUsed: null,
          gasPriceWei: null,
          isError: false,
          methodId: null,
          functionName: null,
          contractCreated: null,
        },
      ],
    };

    const adapter = createMockAdapter({ nativeTxs });
    const entities = createMockEntities({ [binanceCex]: "Binance 14" });

    const result = await buildFundingTree(
      { rootAddress: root, rootChain: "base", maxDepth: 3, mode: "DEFAULT", callBudget: 50 },
      {
        adapter,
        entities,
        nativePriceUsd: "2000.00",
      }
    );

    expect(result.root.children).toHaveLength(1);
    const leaf = result.root.children[0];
    expect(leaf.address).toBe(binanceCex);
    expect(leaf.isTerminalEntity).toBe(true);
    expect(leaf.entityName).toBe("Binance 14");
    expect(leaf.stopReason).toBe("TERMINAL_ENTITY");
    expect(leaf.children).toHaveLength(0);

    // Assert zero calls were spent on binanceCex's history
    // (Only root was queried)
    expect(adapter.calls.getTransactions).toBe(1);
  });

  it("funding: default depth is 3", async () => {
    const nativeTxs: Record<string, RawNativeTx[]> = {
      [root.toLowerCase()]: [
        {
          hash: "0x1",
          blockNumber: 1n,
          timestamp: new Date("2026-01-01T00:00:00Z"),
          from: funder1,
          to: root,
          valueRaw: "1",
          gasUsed: null,
          gasPriceWei: null,
          isError: false,
          methodId: null,
          functionName: null,
          contractCreated: null,
        },
      ],
      [funder1.toLowerCase()]: [
        {
          hash: "0x2",
          blockNumber: 2n,
          timestamp: new Date("2026-01-02T00:00:00Z"),
          from: funder2,
          to: funder1,
          valueRaw: "1",
          gasUsed: null,
          gasPriceWei: null,
          isError: false,
          methodId: null,
          functionName: null,
          contractCreated: null,
        },
      ],
      [funder2.toLowerCase()]: [
        {
          hash: "0x3",
          blockNumber: 3n,
          timestamp: new Date("2026-01-03T00:00:00Z"),
          from: "0x5555555555555555555555555555555555555555" as Address,
          to: funder2,
          valueRaw: "1",
          gasUsed: null,
          gasPriceWei: null,
          isError: false,
          methodId: null,
          functionName: null,
          contractCreated: null,
        },
      ],
    };

    const adapter = createMockAdapter({ nativeTxs });
    const entities = createMockEntities();

    const result = await buildFundingTree(
      { rootAddress: root, rootChain: "base", maxDepth: 3, mode: "DEFAULT", callBudget: 50 },
      {
        adapter,
        entities,
        nativePriceUsd: "2000.00",
      }
    );

    expect(result.root.depth).toBe(0);
    const depth1 = result.root.children[0];
    expect(depth1.depth).toBe(1);
    const depth2 = depth1.children[0];
    expect(depth2.depth).toBe(2);
    const depth3 = depth2.children[0];
    expect(depth3.depth).toBe(3);
    // At depth 3, stops with DEPTH_LIMIT and canDeepTrace: true
    expect(depth3.stopReason).toBe("DEPTH_LIMIT");
    expect(depth3.canDeepTrace).toBe(true);
    expect(depth3.children).toHaveLength(0);
  });

  it("funding: maxDepth above 6 is rejected", async () => {
    const adapter = createMockAdapter({});
    const entities = createMockEntities();

    await expect(
      buildFundingTree(
        { rootAddress: root, rootChain: "base", maxDepth: 7, mode: "DEFAULT", callBudget: 50 },
        { adapter, entities, nativePriceUsd: "2000.00" }
      )
    ).rejects.toThrow(/maxDepth cannot exceed 6/i);
  });

  it("funding: funder with no inbound reports NO_INBOUND", async () => {
    const nativeTxs: Record<string, RawNativeTx[]> = {
      [root.toLowerCase()]: [
        {
          hash: "0x1",
          blockNumber: 1n,
          timestamp: new Date("2026-01-01T00:00:00Z"),
          from: funder1,
          to: root,
          valueRaw: "1",
          gasUsed: null,
          gasPriceWei: null,
          isError: false,
          methodId: null,
          functionName: null,
          contractCreated: null,
        },
      ],
      // funder1 has no transactions in the adapter
    };

    const adapter = createMockAdapter({ nativeTxs });
    const entities = createMockEntities();

    const result = await buildFundingTree(
      { rootAddress: root, rootChain: "base", maxDepth: 3, mode: "DEFAULT", callBudget: 50 },
      { adapter, entities, nativePriceUsd: "2000.00" }
    );

    const f1Node = result.root.children[0];
    expect(f1Node.stopReason).toBe("NO_INBOUND");
    expect(f1Node.canDeepTrace).toBe(false);
  });

  it("funding: cycle reports SELF_REFERENCE and terminates", async () => {
    // root funded by funder1; funder1 funded by root (loop)
    const nativeTxs: Record<string, RawNativeTx[]> = {
      [root.toLowerCase()]: [
        {
          hash: "0x1",
          blockNumber: 1n,
          timestamp: new Date("2026-01-01T00:00:00Z"),
          from: funder1,
          to: root,
          valueRaw: "1",
          gasUsed: null,
          gasPriceWei: null,
          isError: false,
          methodId: null,
          functionName: null,
          contractCreated: null,
        },
      ],
      [funder1.toLowerCase()]: [
        {
          hash: "0x2",
          blockNumber: 2n,
          timestamp: new Date("2026-01-02T00:00:00Z"),
          from: root, // loop back to root
          to: funder1,
          valueRaw: "1",
          gasUsed: null,
          gasPriceWei: null,
          isError: false,
          methodId: null,
          functionName: null,
          contractCreated: null,
        },
      ],
    };

    const adapter = createMockAdapter({ nativeTxs });
    const entities = createMockEntities();

    const result = await buildFundingTree(
      { rootAddress: root, rootChain: "base", maxDepth: 3, mode: "DEFAULT", callBudget: 50 },
      { adapter, entities, nativePriceUsd: "2000.00" }
    );

    const f1Node = result.root.children[0];
    expect(f1Node.children).toHaveLength(1);
    const cycleNode = f1Node.children[0];
    expect(cycleNode.address).toBe(root);
    expect(cycleNode.stopReason).toBe("SELF_REFERENCE");
    expect(cycleNode.children).toHaveLength(0);
  });

  it("funding: totalUsd aggregates native and internal values", async () => {
    const nativeTxs: Record<string, RawNativeTx[]> = {
      [root.toLowerCase()]: [
        {
          hash: "0x1",
          blockNumber: 1n,
          timestamp: new Date("2026-01-01T00:00:00Z"),
          from: funder1,
          to: root,
          valueRaw: "1000000000000000000", // 1 ETH = $2,000
          gasUsed: null,
          gasPriceWei: null,
          isError: false,
          methodId: null,
          functionName: null,
          contractCreated: null,
        },
      ],
    };

    const internalTxs: Record<string, RawInternalTx[]> = {
      [root.toLowerCase()]: [
        {
          hash: "0x2",
          traceId: "1",
          blockNumber: 2n,
          timestamp: new Date("2026-01-02T00:00:00Z"),
          from: funder1,
          to: root,
          valueRaw: "500000000000000000", // 0.5 ETH = $1,000
          isError: false,
          callType: "call",
        },
      ],
    };

    const adapter = createMockAdapter({ nativeTxs, internalTxs });
    const entities = createMockEntities();

    const result = await buildFundingTree(
      { rootAddress: root, rootChain: "base", maxDepth: 3, mode: "DEFAULT", callBudget: 50 },
      { adapter, entities, nativePriceUsd: "2000.00" }
    );

    const f1Node = result.root.children[0];
    expect(f1Node.fundingCount).toBe(2);
    expect(f1Node.internalFundingCount).toBe(1);
    // 1 ETH ($2000) + 0.5 ETH ($1000) = $3000
    expect(parseFloat(f1Node.totalUsdFunded)).toBeCloseTo(3000, 2);
  });

  it("funding: HUMAN-labeled funder is still traced", async () => {
    const nativeTxs: Record<string, RawNativeTx[]> = {
      [root.toLowerCase()]: [
        {
          hash: "0x1",
          blockNumber: 1n,
          timestamp: new Date("2026-01-01T00:00:00Z"),
          from: humanFunder,
          to: root,
          valueRaw: "1",
          gasUsed: null,
          gasPriceWei: null,
          isError: false,
          methodId: null,
          functionName: null,
          contractCreated: null,
        },
      ],
      [humanFunder.toLowerCase()]: [
        {
          hash: "0x2",
          blockNumber: 2n,
          timestamp: new Date("2026-01-02T00:00:00Z"),
          from: funder2,
          to: humanFunder,
          valueRaw: "1",
          gasUsed: null,
          gasPriceWei: null,
          isError: false,
          methodId: null,
          functionName: null,
          contractCreated: null,
        },
      ],
    };

    const adapter = createMockAdapter({ nativeTxs });
    const entities = createMockEntities();

    const result = await buildFundingTree(
      { rootAddress: root, rootChain: "base", maxDepth: 3, mode: "DEFAULT", callBudget: 50 },
      { adapter, entities, nativePriceUsd: "2000.00" }
    );

    const humanNode = result.root.children[0];
    expect(humanNode.address).toBe(humanFunder);
    expect(humanNode.entityName).toBe("Alice");
    expect(humanNode.entityKind).toBe("HUMAN");
    expect(humanNode.isTerminalEntity).toBe(false);
    // Human is not terminal, so it continues tracing its children:
    expect(humanNode.children).toHaveLength(1);
    expect(humanNode.children[0].address).toBe(funder2);
  });
});
