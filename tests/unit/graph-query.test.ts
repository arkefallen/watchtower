import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { loadGraphData, formatCompactUsd } from "@/server/services/interaction/graph-query";

describe("P2-T02: Graph load API with filters", () => {
  it("formatCompactUsd: formats compact amounts correctly", () => {
    expect(formatCompactUsd(0)).toBe("$0");
    expect(formatCompactUsd(450)).toBe("$450");
    expect(formatCompactUsd(999)).toBe("$999");
    expect(formatCompactUsd(1500)).toBe("$1.5K");
    expect(formatCompactUsd(12400)).toBe("$12.4K");
    expect(formatCompactUsd(2400000)).toBe("$2.4M");
  });

  it("graph-query: min USD filter excludes smaller edges", async () => {
    const mockPrisma: any = {
      wallet: {
        findMany: async () => [
          { address: "0xaaaa", chain: "BASE", ensName: "alice.eth", label: "Whale", size: "W", profile: { stableBalanceUsd: new Prisma.Decimal(10000) }, clusterLinks: [] },
          { address: "0xbbbb", chain: "BASE", ensName: "bob.eth", label: "Degen", size: "M", profile: { stableBalanceUsd: new Prisma.Decimal(5000) }, clusterLinks: [] },
        ],
      },
      interactionEdge: {
        findMany: async ({ where }: any) => {
          const edges = [
            {
              id: 1n,
              addressA: "0xaaaa",
              chainA: "BASE",
              addressB: "0xbbbb",
              chainB: "BASE",
              totalUsd: new Prisma.Decimal(500),
              txCount: 2,
              usdAToB: new Prisma.Decimal(500),
              usdBToA: new Prisma.Decimal(0),
              countAToB: 2,
              countBToA: 0,
              firstAt: new Date("2026-08-01"),
              lastAt: new Date("2026-08-02"),
              topTokenSymbol: "PEPE",
              topTokenUsd: new Prisma.Decimal(500),
              distinctTokenCount: 1,
            },
          ];
          const min = where?.totalUsd?.gte ?? 0;
          return edges.filter((e) => Number(e.totalUsd) >= min);
        },
      },
      fundingEdge: {
        findMany: async () => [],
      },
    };

    // minUsd = 100 -> edge is included
    const res1 = await loadGraphData(mockPrisma, { minUsd: 100 });
    expect(res1.nodes.length).toBe(2);
    expect(res1.edges.length).toBe(1);
    expect(res1.edges[0].label).toBe("PEPE · $500");

    // minUsd = 1000 -> edge is excluded
    const res2 = await loadGraphData(mockPrisma, { minUsd: 1000 });
    expect(res2.edges.length).toBe(0);
  });

  it("graph-query: secondary funder nodes appear when toggled", async () => {
    const mockPrisma: any = {
      wallet: {
        findMany: async () => [
          { address: "0xaaaa", chain: "BASE", ensName: null, label: null, size: "S", profile: null, clusterLinks: [] },
        ],
      },
      interactionEdge: {
        findMany: async () => [],
      },
      fundingEdge: {
        findMany: async () => [
          {
            parentAddress: "0xfunder1",
            parentChain: "BASE",
            isPrimaryWallet: true,
            isTerminalEntity: false,
            entityName: "Primary Whale",
          },
        ],
      },
    };

    const resNoSecondary = await loadGraphData(mockPrisma, { includeFunders: false });
    expect(resNoSecondary.nodes.length).toBe(1);

    const resWithSecondary = await loadGraphData(mockPrisma, { includeFunders: true });
    expect(resWithSecondary.nodes.length).toBe(2);
    const funderNode = resWithSecondary.nodes.find((n) => n.isSecondary);
    expect(funderNode).toBeDefined();
    expect(funderNode?.label).toBe("Primary Whale");
    expect(funderNode?.secondaryType).toBe("PRIMARY_WALLET");
  });
});
