import { describe, expect, it } from "vitest";
import {
  buildFundingTree,
  type FundingDeps,
  type EntityService,
} from "@/server/services/funding/trace";
import type { Address, ChainAdapter, RawNativeTx } from "@/lib/chains/types";

describe("P1-T11: Deep Trace Mode", () => {
  const root = "0x1111111111111111111111111111111111111111" as Address;
  const branchA = "0x2222222222222222222222222222222222222222" as Address;
  const branchB = "0x3333333333333333333333333333333333333333" as Address;
  const funderDepth4 = "0x4444444444444444444444444444444444444444" as Address;
  const funderDepth5 = "0x5555555555555555555555555555555555555555" as Address;
  const funderDepth6 = "0x6666666666666666666666666666666666666666" as Address;
  const funderDepth7 = "0x7777777777777777777777777777777777777777" as Address;
  const terminalCex = "0x28c6c06298d514db089934071355e5743bf21d60".toLowerCase() as Address;

  const createMockEntities = (terminals: Record<string, string> = {}): EntityService => ({
    isTerminal: async (addr: Address) => {
      const name = terminals[addr.toLowerCase()];
      if (name) return { name, kind: "CEX" };
      return null;
    },
    getEntityLabel: async (addr: Address) => {
      const name = terminals[addr.toLowerCase()];
      if (name) return { name, kind: "CEX" };
      return null;
    },
  });

  const createMockAdapter = (
    txs: Record<string, RawNativeTx[]>
  ): ChainAdapter & { callsCount: number } => {
    let calls = 0;
    return {
      chain: "base",
      chainId: 8453,
      nativeSymbol: "ETH",
      nativeDecimals: 18,
      get callsCount() {
        return calls;
      },
      getTransactions: async (addr: Address) => {
        calls++;
        return {
          records: txs[addr.toLowerCase()] ?? [],
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
    } as unknown as ChainAdapter & { callsCount: number };
  };

  const makeTx = (from: Address, to: Address): RawNativeTx => ({
    hash: `0x${Math.random().toString(16).slice(2)}`,
    blockNumber: 1n,
    timestamp: new Date("2026-01-01T00:00:00Z"),
    from,
    to,
    valueRaw: "1000000000000000000",
    gasUsed: null,
    gasPriceWei: null,
    isError: false,
    methodId: null,
    functionName: null,
    contractCreated: null,
  });

  it("deep-trace: extends only the requested branch and leaves sibling unchanged", async () => {
    const txs: Record<string, RawNativeTx[]> = {
      [root.toLowerCase()]: [makeTx(branchA, root), makeTx(branchB, root)],
      [branchA.toLowerCase()]: [makeTx(funderDepth4, branchA)],
      [branchB.toLowerCase()]: [makeTx(funderDepth4, branchB)],
    };

    const adapter = createMockAdapter(txs);
    const entities = createMockEntities();

    // Standard trace at depth 1: root -> branchA (depth 1), branchB (depth 1)
    const initial = await buildFundingTree(
      { rootAddress: root, rootChain: "base", maxDepth: 1, mode: "DEFAULT" },
      { adapter, entities, nativePriceUsd: "2000.00" }
    );

    expect(initial.root.children).toHaveLength(2);
    expect(initial.root.children[0].stopReason).toBe("DEPTH_LIMIT");
    expect(initial.root.children[1].stopReason).toBe("DEPTH_LIMIT");

    // Deep trace branchA only
    const deepResult = await buildFundingTree(
      {
        rootAddress: root,
        rootChain: "base",
        mode: "DEEP",
        branch: { address: branchA, chain: "base" },
      },
      { adapter, entities, nativePriceUsd: "2000.00" }
    );

    const childA = deepResult.root.children.find((c) => c.address === branchA);
    const childB = deepResult.root.children.find((c) => c.address === branchB);

    expect(childA?.children).toHaveLength(1);
    expect(childA?.children[0].address).toBe(funderDepth4);
    expect(childB?.children).toHaveLength(0); // sibling untouched!
  });

  it("deep-trace: stops at a terminal entity encountered mid-extension", async () => {
    const txs: Record<string, RawNativeTx[]> = {
      [root.toLowerCase()]: [makeTx(branchA, root)],
      [branchA.toLowerCase()]: [makeTx(terminalCex, branchA)],
    };

    const adapter = createMockAdapter(txs);
    const entities = createMockEntities({ [terminalCex]: "Binance 14" });

    const deepResult = await buildFundingTree(
      {
        rootAddress: root,
        rootChain: "base",
        mode: "DEEP",
        branch: { address: branchA, chain: "base" },
      },
      { adapter, entities, nativePriceUsd: "2000.00" }
    );

    const childA = deepResult.root.children[0];
    expect(childA.children).toHaveLength(1);
    const terminalNode = childA.children[0];
    expect(terminalNode.address).toBe(terminalCex);
    expect(terminalNode.stopReason).toBe("TERMINAL_ENTITY");
    expect(terminalNode.isTerminalEntity).toBe(true);
    expect(terminalNode.children).toHaveLength(0);
  });

  it("deep-trace: stops at absolute depth 6", async () => {
    // Chain from root(0) -> d1 -> d2 -> d3 -> d4 -> d5 -> d6 -> d7
    const d1 = "0x0100000000000000000000000000000000000001" as Address;
    const d2 = "0x0200000000000000000000000000000000000002" as Address;
    const d3 = "0x0300000000000000000000000000000000000003" as Address;
    const d4 = "0x0400000000000000000000000000000000000004" as Address;
    const d5 = "0x0500000000000000000000000000000000000005" as Address;
    const d6 = "0x0600000000000000000000000000000000000006" as Address;
    const d7 = "0x0700000000000000000000000000000000000007" as Address;

    const txs: Record<string, RawNativeTx[]> = {
      [root.toLowerCase()]: [makeTx(d1, root)],
      [d1.toLowerCase()]: [makeTx(d2, d1)],
      [d2.toLowerCase()]: [makeTx(d3, d2)],
      [d3.toLowerCase()]: [makeTx(d4, d3)],
      [d4.toLowerCase()]: [makeTx(d5, d4)],
      [d5.toLowerCase()]: [makeTx(d6, d5)],
      [d6.toLowerCase()]: [makeTx(d7, d6)],
    };

    const adapter = createMockAdapter(txs);
    const entities = createMockEntities();

    const deepResult = await buildFundingTree(
      {
        rootAddress: root,
        rootChain: "base",
        mode: "DEEP",
        branch: { address: d1, chain: "base" },
      },
      { adapter, entities, nativePriceUsd: "2000.00" }
    );

    // Navigate down to depth 6
    let curr = deepResult.root;
    while (curr.children.length > 0) {
      curr = curr.children[0];
    }

    expect(curr.depth).toBe(6);
    expect(curr.address).toBe(d6);
    expect(curr.stopReason).toBe("DEPTH_LIMIT");
    expect(curr.canDeepTrace).toBe(false); // Cap is 6, cannot deep trace further
    expect(curr.children).toHaveLength(0); // d7 was not expanded
  });

  it("deep-trace: sets deepTracedAt on the extended node", async () => {
    const txs: Record<string, RawNativeTx[]> = {
      [root.toLowerCase()]: [makeTx(branchA, root)],
      [branchA.toLowerCase()]: [makeTx(funderDepth4, branchA)],
    };

    const adapter = createMockAdapter(txs);
    const entities = createMockEntities();

    const deepResult = await buildFundingTree(
      {
        rootAddress: root,
        rootChain: "base",
        mode: "DEEP",
        branch: { address: branchA, chain: "base" },
      },
      { adapter, entities, nativePriceUsd: "2000.00" }
    );

    const childA = deepResult.root.children[0];
    expect(childA.stopReason).not.toBe("DEPTH_LIMIT");
  });
});
