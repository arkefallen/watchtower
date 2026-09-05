import { describe, expect, it } from "vitest";
import { loadScenario, createMockChainAdapter } from "@/lib/chains/mock-adapter";
import { buildFundingTree } from "@/server/services/funding/trace";
import { detectClustersFromEdges } from "@/server/services/cluster/detect";
import { parseImportBatch } from "@/server/services/wallet/import";
import { buildPhase1Csv, PHASE1_WALLETS } from "../helpers/e2e-import";
import type { Address } from "@/lib/chains/types";

describe("Phase 1 Acceptance Criteria: Registry & Funding Tracer (SRS §8)", () => {
  it("criterion 1: 10 wallets imported via CSV with per-line validation and dedupe", () => {
    const csv = buildPhase1Csv();
    const parsed = parseImportBatch(csv, "base");

    expect(parsed.entries).toHaveLength(10);
    expect(parsed.invalid).toHaveLength(0);
    expect(parsed.entries.map((v) => v.address)).toEqual(
      PHASE1_WALLETS.map((w) => w.address.toLowerCase())
    );

    // Duplicate within batch deduplicated
    const withDupes = `${csv}\n${PHASE1_WALLETS[0].address},${PHASE1_WALLETS[0].chain},Duplicate Line`;
    const parsedWithDupes = parseImportBatch(withDupes, "base");
    expect(parsedWithDupes.entries).toHaveLength(10);
    expect(parsedWithDupes.duplicates).toHaveLength(1);
    expect(parsedWithDupes.duplicates[0].address).toBe(PHASE1_WALLETS[0].address.toLowerCase());
  });

  it("criterion 2 & 3: known CEX funder displays as a terminal entity leaf in funding tree", async () => {
    const scenario = await loadScenario("phase1-bundle");
    const adapter = createMockChainAdapter("bsc", scenario);

    const target1 = "0x1000000000000000000000000000000000000001" as Address;
    const binanceCex = "0xf977814e90da44bfa03b6295a0616a897441acec" as Address;

    const mockEntityService = {
      isTerminal: async (addr: Address) => {
        if (addr.toLowerCase() === binanceCex.toLowerCase()) {
          return { name: "Binance Hot Wallet 20", kind: "CEX" as const };
        }
        return null;
      },
      getEntityLabel: async (addr: Address) => {
        if (addr.toLowerCase() === binanceCex.toLowerCase()) {
          return { name: "Binance Hot Wallet 20", kind: "CEX" as const };
        }
        return null;
      },
    };

    const tree = await buildFundingTree(
      { rootAddress: target1, rootChain: "bsc", maxDepth: 3 },
      { adapter, entities: mockEntityService }
    );

    expect(tree.root.children).toHaveLength(1);
    const cexNode = tree.root.children[0];
    expect(cexNode.address).toBe(binanceCex.toLowerCase());
    expect(cexNode.isTerminalEntity).toBe(true);
    expect(cexNode.entityName).toBe("Binance Hot Wallet 20");
    expect(cexNode.entityKind).toBe("CEX");
    expect(cexNode.stopReason).toBe("TERMINAL_ENTITY");
    expect(cexNode.children).toHaveLength(0);

    // Proves zero further explorer calls spent on terminal node's upstream history
    expect(adapter.stats().getTransactions).toBe(1);
  });

  it("criterion 4: shared funders auto-create clusters across tracked wallets", async () => {
    const sharedFunder = "0x33b800000000000000000000000000000000aa90" as Address;

    // Simulate funding edges linking 3 tracked wallets to the shared funder
    const edges = [
      {
        rootAddress: "0x1000000000000000000000000000000000000002" as Address,
        rootChain: "base" as const,
        parentAddress: sharedFunder,
        parentChain: "base" as const,
        childAddress: "0x1000000000000000000000000000000000000002" as Address,
        childChain: "base" as const,
        isTerminalEntity: false,
      },
      {
        rootAddress: "0x1000000000000000000000000000000000000003" as Address,
        rootChain: "base" as const,
        parentAddress: sharedFunder,
        parentChain: "base" as const,
        childAddress: "0x1000000000000000000000000000000000000003" as Address,
        childChain: "base" as const,
        isTerminalEntity: false,
      },
      {
        rootAddress: "0x1000000000000000000000000000000000000004" as Address,
        rootChain: "base" as const,
        parentAddress: sharedFunder,
        parentChain: "base" as const,
        childAddress: "0x1000000000000000000000000000000000000004" as Address,
        childChain: "base" as const,
        isTerminalEntity: false,
      },
    ];

    const clusters = detectClustersFromEdges(edges);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].funderAddress.toLowerCase()).toBe(sharedFunder.toLowerCase());
    expect(clusters[0].members).toHaveLength(3);
    expect(clusters[0].colorHex).toMatch(/^#[0-9a-f]{6}$/i);
    expect(clusters[0].members).toContain("0x1000000000000000000000000000000000000002");
    expect(clusters[0].members).toContain("0x1000000000000000000000000000000000000003");
    expect(clusters[0].members).toContain("0x1000000000000000000000000000000000000004");
  });

  it("criterion 5: deep-trace extends depth-limited branch up to 6 hops", async () => {
    const scenario = await loadScenario("phase1-bundle");
    const adapter = createMockChainAdapter("base", scenario);

    const target6 = "0x1000000000000000000000000000000000000006" as Address;
    const branch1 = "0x6001000000000000000000000000000000000001" as Address;

    const mockEntityService = {
      isTerminal: async () => null,
      getEntityLabel: async () => null,
    };

    // 1. Initial build at default maxDepth = 3
    const initialTree = await buildFundingTree(
      { rootAddress: target6, rootChain: "base", maxDepth: 3 },
      { adapter, entities: mockEntityService }
    );

    // Find the depth-3 leaf
    const hop1 = initialTree.root.children[0];
    const hop2 = hop1?.children[0];
    const hop3 = hop2?.children[0];

    expect(hop3).toBeDefined();
    expect(hop3?.depth).toBe(3);
    expect(hop3?.stopReason).toBe("DEPTH_LIMIT");
    expect(hop3?.canDeepTrace).toBe(true);

    // 2. Deep trace extends that branch up to depth 6
    const extendedTree = await buildFundingTree(
      {
        rootAddress: target6,
        rootChain: "base",
        mode: "DEEP",
        branch: {
          address: branch1,
          chain: "base",
        },
      },
      { adapter, entities: mockEntityService }
    );

    const extHop1 = extendedTree.root.children[0];
    const extHop2 = extHop1?.children[0];
    const extHop3 = extHop2?.children[0];
    const extHop4 = extHop3?.children[0];

    expect(extHop4).toBeDefined();
    expect(extHop4?.depth).toBe(4);
    expect(extHop4?.address).toBe("0x6004000000000000000000000000000000000004");
  });

  it("internal-tx-only funding criterion (SRS §10.4): captures contract traces", async () => {
    const scenario = await loadScenario("phase1-bundle");
    const adapter = createMockChainAdapter("base", scenario);

    const target5 = "0x1000000000000000000000000000000000000005" as Address;
    const internalFunder = "0x55d10000000000000000000000000000000009eb" as Address;

    const mockEntityService = {
      isTerminal: async () => null,
      getEntityLabel: async () => null,
    };

    const tree = await buildFundingTree(
      { rootAddress: target5, rootChain: "base", maxDepth: 3 },
      { adapter, entities: mockEntityService }
    );

    expect(tree.root.children).toHaveLength(1);
    const node = tree.root.children[0];
    expect(node.address).toBe(internalFunder.toLowerCase());
    expect(node.internalFundingCount).toBe(1);
  });
});
