import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import {
  areMutuallyIndependent,
  computeWalletVerdict,
  rebuildWalletRelations,
} from "@/server/services/independence/verdict";
import { INDEPENDENT_VERBATIM } from "@/server/services/independence/statements";

describe("P2-T06: Independence verdict computation and panel", () => {
  it("independence: shared non-terminal funder creates a SHARED_FUNDER relation", async () => {
    const mockPrisma: any = {
      interactionEdge: { findFirst: async () => null },
      fundingEdge: {
        findMany: async ({ where }: any) => {
          if (where.rootAddress === "0xaaaa") {
            return [{ parentAddress: "0xfunder99", parentChain: "BASE", entityName: "Shared Whale" }];
          }
          if (where.rootAddress === "0xbbbb") {
            return [{ parentAddress: "0xfunder99", parentChain: "BASE", entityName: "Shared Whale" }];
          }
          return [];
        },
      },
      clusterMember: { findMany: async () => [] },
    };

    const res = await areMutuallyIndependent(mockPrisma, {
      a: { address: "0xaaaa", chain: "BASE" },
      b: { address: "0xbbbb", chain: "BASE" },
    });

    expect(res.independent).toBe(false);
    expect(res.links.length).toBe(1);
    expect(res.links[0].kind).toBe("SHARED_FUNDER");
    expect(res.links[0].statement).toContain("via shared funder Shared Whale");
  });

  it("independence: direct transfer relation reports txCount and USD", async () => {
    const mockPrisma: any = {
      interactionEdge: {
        findFirst: async () => ({
          txCount: 23,
          totalUsd: new Prisma.Decimal(45200),
          usdAToB: new Prisma.Decimal(45200),
          usdBToA: new Prisma.Decimal(0),
        }),
      },
      fundingEdge: { findMany: async () => [] },
      clusterMember: { findMany: async () => [] },
    };

    const res = await areMutuallyIndependent(mockPrisma, {
      a: { address: "0xaaaa000000000000000000000000000000000001", chain: "BASE" },
      b: { address: "0xbbbb000000000000000000000000000000000002", chain: "BASE" },
    });

    expect(res.independent).toBe(false);
    expect(res.links.length).toBe(1);
    expect(res.links[0].kind).toBe("DIRECT_TRANSFER");
    expect(res.links[0].statement).toContain("via direct transfers (23 txs, $45.2K)");
  });

  it("independence: same-cluster relation is detected", async () => {
    const mockPrisma: any = {
      interactionEdge: { findFirst: async () => null },
      fundingEdge: { findMany: async () => [] },
      clusterMember: {
        findMany: async ({ where }: any) => {
          if (where.walletAddress === "0xaaaa") {
            return [{ clusterId: "c1", cluster: { name: "Alpha Snipers" } }];
          }
          if (where.walletAddress === "0xbbbb") {
            return [{ clusterId: "c1", cluster: { name: "Alpha Snipers" } }];
          }
          return [];
        },
      },
    };

    const res = await areMutuallyIndependent(mockPrisma, {
      a: { address: "0xaaaa", chain: "BASE" },
      b: { address: "0xbbbb", chain: "BASE" },
    });

    expect(res.independent).toBe(false);
    expect(res.links.length).toBe(1);
    expect(res.links[0].kind).toBe("SAME_CLUSTER");
    expect(res.links[0].statement).toContain("via cluster Alpha Snipers");
  });

  it("independence: isolated wallet returns the exact INDEPENDENT sentence", async () => {
    const mockPrisma: any = {
      walletRelation: {
        findMany: async () => [],
      },
    };

    const verdict = await computeWalletVerdict(mockPrisma, {
      address: "0xisolated",
      chain: "BASE",
    });

    expect(verdict.isIndependentOfAll).toBe(true);
    expect(verdict.statements).toHaveLength(1);
    expect(verdict.statements[0]).toBe(INDEPENDENT_VERBATIM);
    expect(verdict.statements[0]).toBe(
      "INDEPENDENT — no funding, transfer, or co-entry relationship with any other tracked wallet."
    );
  });
});
