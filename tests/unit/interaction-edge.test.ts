import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { getCanonicalPair } from "@/server/services/interaction/canonical";
import { aggregateInteractionEdges } from "@/server/services/interaction/aggregate";

describe("P2-T01: Interaction edge aggregation", () => {
  it("edges: canonical ordering is stable when arguments are swapped", () => {
    const pair1 = getCanonicalPair("0xBBBB111122223333444455556666777788889999", "BASE", "0xAAAA111122223333444455556666777788889999", "BASE");
    const pair2 = getCanonicalPair("0xAAAA111122223333444455556666777788889999", "BASE", "0xBBBB111122223333444455556666777788889999", "BASE");

    expect(pair1.addressA).toBe("0xaaaa111122223333444455556666777788889999");
    expect(pair1.addressB).toBe("0xbbbb111122223333444455556666777788889999");
    expect(pair2.addressA).toBe(pair1.addressA);
    expect(pair2.addressB).toBe(pair1.addressB);
    expect(pair1.isOriginalOrder).toBe(false);
    expect(pair2.isOriginalOrder).toBe(true);
  });

  it("edges: one row per wallet pair and chain regardless of direction", async () => {
    const walletA = "0x1111111111111111111111111111111111111111";
    const walletB = "0x2222222222222222222222222222222222222222";

    const edgesStore = new Map<string, any>();
    const tokensStore = new Map<string, any>();

    const mockPrisma: any = {
      wallet: {
        findMany: async () => [
          { address: walletA, chain: "BASE" },
          { address: walletB, chain: "BASE" },
        ],
      },
      transaction: {
        findMany: async () => [
          {
            hash: "0xtx1",
            chain: "BASE",
            timestamp: new Date("2026-08-01T10:00:00Z"),
            fromAddress: walletA,
            toAddress: walletB,
            tokenAddress: "0xpepe",
            tokenSymbol: "PEPE",
            amountRaw: "1000",
            amountUsd: new Prisma.Decimal(500),
          },
          {
            hash: "0xtx2",
            chain: "BASE",
            timestamp: new Date("2026-08-02T12:00:00Z"),
            fromAddress: walletB,
            toAddress: walletA,
            tokenAddress: "0xpepe",
            tokenSymbol: "PEPE",
            amountRaw: "400",
            amountUsd: new Prisma.Decimal(200),
          },
        ],
      },
      interactionEdge: {
        upsert: async ({ where, create, update }: any) => {
          const key = `${where.interaction_edge_key.chainA}:${where.interaction_edge_key.addressA}-${where.interaction_edge_key.chainB}:${where.interaction_edge_key.addressB}`;
          const val = { id: 101n, ...(edgesStore.get(key) ? update : create) };
          edgesStore.set(key, val);
          return val;
        },
      },
      interactionEdgeToken: {
        upsert: async ({ where, create, update }: any) => {
          const key = `${where.edgeId_tokenAddress.edgeId}:${where.edgeId_tokenAddress.tokenAddress}`;
          const val = { id: 201n, ...(tokensStore.get(key) ? update : create) };
          tokensStore.set(key, val);
          return val;
        },
      },
    };

    const res = await aggregateInteractionEdges(mockPrisma);
    expect(res.edgesCreatedOrUpdated).toBe(1);
    expect(edgesStore.size).toBe(1);

    const edge = Array.from(edgesStore.values())[0];
    expect(edge.txCount).toBe(2);
    expect(edge.totalUsd.toString()).toBe("700");
    expect(edge.usdAToB.toString()).toBe("500");
    expect(edge.usdBToA.toString()).toBe("200");
    expect(edge.countAToB).toBe(1);
    expect(edge.countBToA).toBe(1);
    expect(edge.topTokenSymbol).toBe("PEPE");
  });

  it("edges: directional USD and counts split correctly for multi-token pair", async () => {
    const walletA = "0xaaaa000000000000000000000000000000000001";
    const walletB = "0xbbbb000000000000000000000000000000000002";

    const edgesStore = new Map<string, any>();
    const tokensStore = new Map<string, any>();

    const mockPrisma: any = {
      wallet: {
        findMany: async () => [
          { address: walletA, chain: "BASE" },
          { address: walletB, chain: "BASE" },
        ],
      },
      transaction: {
        findMany: async () => [
          // 3 transfers A -> B on PEPE ($300)
          { hash: "0xtx1", chain: "BASE", timestamp: new Date("2026-08-01"), fromAddress: walletA, toAddress: walletB, tokenAddress: "0xpepe", tokenSymbol: "PEPE", amountRaw: "10", amountUsd: new Prisma.Decimal(100) },
          { hash: "0xtx2", chain: "BASE", timestamp: new Date("2026-08-02"), fromAddress: walletA, toAddress: walletB, tokenAddress: "0xpepe", tokenSymbol: "PEPE", amountRaw: "20", amountUsd: new Prisma.Decimal(200) },
          // 1 transfer B -> A on USDC ($500)
          { hash: "0xtx3", chain: "BASE", timestamp: new Date("2026-08-03"), fromAddress: walletB, toAddress: walletA, tokenAddress: "0xusdc", tokenSymbol: "USDC", amountRaw: "500", amountUsd: new Prisma.Decimal(500) },
        ],
      },
      interactionEdge: {
        upsert: async ({ where, create, update }: any) => {
          const key = `${where.interaction_edge_key.chainA}:${where.interaction_edge_key.addressA}-${where.interaction_edge_key.chainB}:${where.interaction_edge_key.addressB}`;
          const val = { id: 101n, ...(edgesStore.get(key) ? update : create) };
          edgesStore.set(key, val);
          return val;
        },
      },
      interactionEdgeToken: {
        upsert: async ({ where, create, update }: any) => {
          const key = `${where.edgeId_tokenAddress.edgeId}:${where.edgeId_tokenAddress.tokenAddress}`;
          const val = { id: 201n, ...(tokensStore.get(key) ? update : create) };
          tokensStore.set(key, val);
          return val;
        },
      },
    };

    await aggregateInteractionEdges(mockPrisma);
    const edge = Array.from(edgesStore.values())[0];
    expect(edge.txCount).toBe(3);
    expect(edge.totalUsd.toString()).toBe("800");
    expect(edge.usdAToB.toString()).toBe("300");
    expect(edge.usdBToA.toString()).toBe("500");
    expect(edge.countAToB).toBe(2);
    expect(edge.countBToA).toBe(1);
    expect(edge.distinctTokenCount).toBe(2);
    // Top token by totalUsd is USDC ($500 vs $300)
    expect(edge.topTokenSymbol).toBe("USDC");
    expect(tokensStore.size).toBe(2);
  });

  it("edges: native transfers produce a null-token breakdown row with chain native symbol", async () => {
    const walletA = "0xaaaa000000000000000000000000000000000001";
    const walletB = "0xbbbb000000000000000000000000000000000002";

    const tokensStore = new Map<string, any>();

    const mockPrisma: any = {
      wallet: {
        findMany: async () => [
          { address: walletA, chain: "BASE" },
          { address: walletB, chain: "BASE" },
        ],
      },
      transaction: {
        findMany: async () => [
          { hash: "0xtx_native", chain: "BASE", timestamp: new Date("2026-08-01"), fromAddress: walletA, toAddress: walletB, tokenAddress: null, tokenSymbol: null, amountRaw: "1000000000000000000", amountUsd: new Prisma.Decimal(2500) },
        ],
      },
      interactionEdge: {
        upsert: async () => ({ id: 101n }),
      },
      interactionEdgeToken: {
        upsert: async ({ create }: any) => {
          tokensStore.set("native", create);
          return create;
        },
      },
    };

    await aggregateInteractionEdges(mockPrisma);
    const nativeToken = tokensStore.get("native");
    expect(nativeToken.tokenAddress).toBeNull();
    expect(nativeToken.tokenSymbol).toBe("ETH");
    expect(nativeToken.totalUsd.toString()).toBe("2500");
  });

  it("edges: transfers involving an untracked address are excluded", async () => {
    const tracked1 = "0xaaaa000000000000000000000000000000000001";
    const untracked = "0xcccc000000000000000000000000000000000003";

    const edgesStore = new Map<string, any>();

    const mockPrisma: any = {
      wallet: {
        findMany: async () => [
          { address: tracked1, chain: "BASE" },
        ],
      },
      transaction: {
        findMany: async () => [
          { hash: "0xtx1", chain: "BASE", timestamp: new Date(), fromAddress: tracked1, toAddress: untracked, tokenAddress: null, amountRaw: "1", amountUsd: new Prisma.Decimal(10) },
        ],
      },
      interactionEdge: {
        upsert: async () => {
          edgesStore.set("edge", {});
        },
      },
      interactionEdgeToken: {
        upsert: async () => {},
      },
    };

    const res = await aggregateInteractionEdges(mockPrisma);
    expect(res.edgesCreatedOrUpdated).toBe(0);
    expect(edgesStore.size).toBe(0);
  });
});
