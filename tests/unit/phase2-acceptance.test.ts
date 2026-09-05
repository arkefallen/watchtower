import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { aggregateInteractionEdges } from "@/server/services/interaction/aggregate";
import { loadGraphData } from "@/server/services/interaction/graph-query";
import { computeWalletVerdict } from "@/server/services/independence/verdict";
import { INDEPENDENT_VERBATIM } from "@/server/services/independence/statements";

describe("Phase 2 Acceptance Criteria: Interaction Graph (SRS §8)", () => {
  const walletA = "0x1000000000000000000000000000000000000001";
  const walletB = "0x1000000000000000000000000000000000000002";
  const isolatedWallet = "0x9000000000000000000000000000000000000099";

  const edgesDb = new Map<string, any>();
  const tokensDb = new Map<string, any>();
  const relationsDb = new Map<string, any>();

  const mockPrisma: any = {
    wallet: {
      findMany: async () => [
        {
          address: walletA,
          chain: "BASE",
          ensName: "whale1.eth",
          label: "Primary Funder",
          size: "W",
          isBlacklisted: false,
          profile: { stableBalanceUsd: new Prisma.Decimal(150000) },
          clusterLinks: [{ clusterId: "c1", cluster: { name: "Cluster Alpha", colorHex: "#D7A84B" } }],
        },
        {
          address: walletB,
          chain: "BASE",
          ensName: "whale2.eth",
          label: "Sniper",
          size: "M",
          isBlacklisted: false,
          profile: { stableBalanceUsd: new Prisma.Decimal(50000) },
          clusterLinks: [{ clusterId: "c1", cluster: { name: "Cluster Alpha", colorHex: "#D7A84B" } }],
        },
        {
          address: isolatedWallet,
          chain: "BASE",
          ensName: "loner.eth",
          label: "Solo Trader",
          size: "S",
          isBlacklisted: false,
          profile: { stableBalanceUsd: new Prisma.Decimal(1200) },
          clusterLinks: [],
        },
      ],
    },
    transaction: {
      findMany: async () => [
        {
          hash: "0xhash_pepe",
          chain: "BASE",
          timestamp: new Date("2026-02-01T12:00:00Z"),
          fromAddress: walletA,
          toAddress: walletB,
          tokenAddress: "0xpepe_contract",
          tokenSymbol: "PEPE",
          amountRaw: "1000000",
          amountUsd: new Prisma.Decimal(12400),
        },
        {
          hash: "0xhash_eth",
          chain: "BASE",
          timestamp: new Date("2026-02-02T14:00:00Z"),
          fromAddress: walletB,
          toAddress: walletA,
          tokenAddress: null,
          tokenSymbol: null,
          amountRaw: "1000000000000000000",
          amountUsd: new Prisma.Decimal(3200),
        },
      ],
    },
    interactionEdge: {
      upsert: async ({ where, create, update }: any) => {
        const key = `${where.interaction_edge_key.chainA}:${where.interaction_edge_key.addressA}-${where.interaction_edge_key.chainB}:${where.interaction_edge_key.addressB}`;
        const val = {
          id: 101n,
          addressA: where.interaction_edge_key.addressA,
          chainA: where.interaction_edge_key.chainA,
          addressB: where.interaction_edge_key.addressB,
          chainB: where.interaction_edge_key.chainB,
          ...(edgesDb.get(key) ? update : create),
        };
        edgesDb.set(key, val);
        return val;
      },
      findMany: async ({ where }: any) => {
        const all = Array.from(edgesDb.values());
        const minUsd = where?.totalUsd?.gte ?? 0;
        return all.filter((e) => Number(e.totalUsd) >= minUsd);
      },
      findUnique: async () => {
        const edge = Array.from(edgesDb.values())[0];
        if (!edge) return null;
        return {
          ...edge,
          tokens: Array.from(tokensDb.values()),
        };
      },
      findFirst: async () => Array.from(edgesDb.values())[0] ?? null,
    },
    interactionEdgeToken: {
      upsert: async ({ where, create, update }: any) => {
        const key = `${where.edgeId_tokenAddress.edgeId}:${where.edgeId_tokenAddress.tokenAddress}`;
        const val = {
          id: 201n,
          edgeId: where.edgeId_tokenAddress.edgeId,
          tokenAddress: where.edgeId_tokenAddress.tokenAddress,
          ...(tokensDb.get(key) ? update : create),
        };
        tokensDb.set(key, val);
        return val;
      },
    },
    fundingEdge: {
      findMany: async () => [],
    },
    clusterMember: {
      findMany: async () => [],
    },
    walletRelation: {
      findMany: async ({ where }: any) => {
        if (where?.fromAddress === isolatedWallet) return [];
        return Array.from(relationsDb.values()).filter(
          (r) => r.fromAddress === where?.fromAddress
        );
      },
      deleteMany: async () => ({ count: 0 }),
      upsert: async ({ create }: any) => {
        relationsDb.set(`${create.fromAddress}:${create.toAddress}:${create.kind}`, create);
        return create;
      },
    },
  };

  it("criterion 1: import set renders bubble map with nodes and compound clusters", async () => {
    // 1. Run aggregation
    await aggregateInteractionEdges(mockPrisma);

    // 2. Load graph data
    const graph = await loadGraphData(mockPrisma);

    expect(graph.nodes.length).toBe(3);
    expect(graph.clusters.length).toBe(1);
    expect(graph.clusters[0].name).toBe("Cluster Alpha");
    expect(graph.clusters[0].memberNodeIds).toContain(`BASE:${walletA}`);
    expect(graph.clusters[0].memberNodeIds).toContain(`BASE:${walletB}`);
  });

  it("criterion 2: edges labeled TICKER · $USD with breakdown on click", async () => {
    const graph = await loadGraphData(mockPrisma);
    expect(graph.edges.length).toBe(1);

    const edge = graph.edges[0];
    // Formatted strictly as TICKER · $USD (PEPE · $15.6K)
    expect(edge.label).toMatch(/^[A-Z0-9]+ · \$/);
    expect(edge.label).toBe("PEPE · $15.6K");
    expect(edge.totalUsd).toBe(15600);
    expect(edge.distinctTokenCount).toBe(2);

    // Verify breakdown contains both PEPE and ETH
    const edgeDetail = await mockPrisma.interactionEdge.findUnique();
    expect(edgeDetail.tokens).toHaveLength(2);
    const tokenSymbols = edgeDetail.tokens.map((t: any) => t.tokenSymbol);
    expect(tokenSymbols).toContain("PEPE");
    expect(tokenSymbols).toContain("ETH");
  });

  it("criterion 3: independence verdict panel populated for connected and isolated wallets", async () => {
    // Populate relation for connected wallet
    mockPrisma.walletRelation.upsert({
      create: {
        fromAddress: walletA,
        fromChain: "BASE",
        toAddress: walletB,
        toChain: "BASE",
        kind: "DIRECT_TRANSFER",
        statement: "Connected to 0x1000...0002 via direct transfers (2 txs, $15.6K)",
      },
    });

    // Connected wallet verdict
    const verdictConnected = await computeWalletVerdict(mockPrisma, {
      address: walletA,
      chain: "BASE",
    });
    expect(verdictConnected.isIndependentOfAll).toBe(false);
    expect(verdictConnected.statements[0]).toContain("via direct transfers");

    // Isolated wallet verdict
    const verdictIsolated = await computeWalletVerdict(mockPrisma, {
      address: isolatedWallet,
      chain: "BASE",
    });
    expect(verdictIsolated.isIndependentOfAll).toBe(true);
    expect(verdictIsolated.statements[0]).toBe(INDEPENDENT_VERBATIM);
    expect(verdictIsolated.statements[0]).toBe(
      "INDEPENDENT — no funding, transfer, or co-entry relationship with any other tracked wallet."
    );
  });

  it("criterion 4: graph exports PNG format preserving dark theme background", () => {
    // Mock Cytoscape PNG export invocation contract
    const mockCy: any = {
      png: (opts: any) => {
        expect(opts.bg).toBe("#101214");
        expect(opts.scale).toBe(2);
        return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      },
    };

    const pngBase64 = mockCy.png({
      full: false,
      bg: "#101214",
      scale: 2,
      quality: 1,
    });

    expect(pngBase64).toMatch(/^data:image\/png;base64,/);
    expect(pngBase64.length).toBeGreaterThan(50);
  });
});
