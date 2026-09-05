import { describe, expect, it } from "vitest";
import { getClusterColor } from "@/lib/format/cluster-color";
import {
  detectClustersFromEdges,
  type ClusterFundingEdgeInput,
  type ClusterMemberStats,
} from "@/server/services/cluster/detect";
import type { Address } from "@/lib/chains/types";

describe("P1-T12: Shared-Funder Clustering", () => {
  const wallet1 = "0x1111111111111111111111111111111111111111" as Address;
  const wallet2 = "0x2222222222222222222222222222222222222222" as Address;
  const wallet3 = "0x3333333333333333333333333333333333333333" as Address;
  const wallet4 = "0x4444444444444444444444444444444444444444" as Address;

  const sharedFunder = "0x9999999999999999999999999999999999999999" as Address;
  const binanceCex = "0x28c6c06298d514db089934071355e5743bf21d60".toLowerCase() as Address;

  const statsMap: Record<string, ClusterMemberStats> = {
    [wallet1.toLowerCase()]: { stableUsd: "100.00", lastActivityAt: new Date("2026-01-01T00:00:00Z") },
    [wallet2.toLowerCase()]: { stableUsd: "250.00", lastActivityAt: new Date("2026-01-02T00:00:00Z") },
    [wallet3.toLowerCase()]: { stableUsd: "400.00", lastActivityAt: new Date("2026-01-03T00:00:00Z") },
    [wallet4.toLowerCase()]: { stableUsd: "50.00", lastActivityAt: new Date("2026-01-04T00:00:00Z") },
  };

  it("cluster: colorHex is deterministic for a given funder address", () => {
    const c1 = getClusterColor(sharedFunder);
    const c2 = getClusterColor(sharedFunder);
    const c3 = getClusterColor(sharedFunder.toUpperCase());
    expect(c1).toBe(c2);
    expect(c1).toBe(c3);
    expect(c1).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("cluster: two wallets sharing a non-terminal funder create one cluster", () => {
    const edges: ClusterFundingEdgeInput[] = [
      {
        rootAddress: wallet1,
        rootChain: "base",
        parentAddress: sharedFunder,
        parentChain: "base",
        isTerminalEntity: false,
      },
      {
        rootAddress: wallet2,
        rootChain: "base",
        parentAddress: sharedFunder,
        parentChain: "base",
        isTerminalEntity: false,
      },
    ];

    const clusters = detectClustersFromEdges(edges, statsMap);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].funderAddress).toBe(sharedFunder);
    expect(clusters[0].members).toHaveLength(2);
    expect(clusters[0].members).toContain(wallet1.toLowerCase());
    expect(clusters[0].members).toContain(wallet2.toLowerCase());
  });

  it("cluster: shared terminal entity creates no cluster", () => {
    const edges: ClusterFundingEdgeInput[] = [
      {
        rootAddress: wallet1,
        rootChain: "base",
        parentAddress: binanceCex,
        parentChain: "base",
        isTerminalEntity: true, // Binance CEX hot wallet
      },
      {
        rootAddress: wallet2,
        rootChain: "base",
        parentAddress: binanceCex,
        parentChain: "base",
        isTerminalEntity: true,
      },
    ];

    const clusters = detectClustersFromEdges(edges, statsMap);
    expect(clusters).toHaveLength(0);
  });

  it("cluster: third wallet joins the existing cluster", () => {
    const edges: ClusterFundingEdgeInput[] = [
      { rootAddress: wallet1, rootChain: "base", parentAddress: sharedFunder, parentChain: "base", isTerminalEntity: false },
      { rootAddress: wallet2, rootChain: "base", parentAddress: sharedFunder, parentChain: "base", isTerminalEntity: false },
      { rootAddress: wallet3, rootChain: "base", parentAddress: sharedFunder, parentChain: "base", isTerminalEntity: false },
    ];

    const clusters = detectClustersFromEdges(edges, statsMap);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members).toHaveLength(3);
    expect(clusters[0].memberCount).toBe(3);
  });

  it("cluster: memberCount and combinedStableUsd roll up correctly", () => {
    const edges: ClusterFundingEdgeInput[] = [
      { rootAddress: wallet1, rootChain: "base", parentAddress: sharedFunder, parentChain: "base", isTerminalEntity: false },
      { rootAddress: wallet2, rootChain: "base", parentAddress: sharedFunder, parentChain: "base", isTerminalEntity: false },
      { rootAddress: wallet3, rootChain: "base", parentAddress: sharedFunder, parentChain: "base", isTerminalEntity: false },
    ];

    const clusters = detectClustersFromEdges(edges, statsMap);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].memberCount).toBe(3);
    // 100 + 250 + 400 = 750
    expect(parseFloat(clusters[0].combinedStableUsd)).toBeCloseTo(750, 2);
    expect(clusters[0].lastActivityAt).toEqual(new Date("2026-01-03T00:00:00Z"));
  });

  it("cluster: removing a wallet removes its membership but keeps the cluster when ≥2 remain", () => {
    // wallet1, wallet2, wallet3 started in cluster; now wallet3 is removed
    const edgesAfterRemoval: ClusterFundingEdgeInput[] = [
      { rootAddress: wallet1, rootChain: "base", parentAddress: sharedFunder, parentChain: "base", isTerminalEntity: false },
      { rootAddress: wallet2, rootChain: "base", parentAddress: sharedFunder, parentChain: "base", isTerminalEntity: false },
    ];

    const clusters = detectClustersFromEdges(edgesAfterRemoval, statsMap);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members).toHaveLength(2);
    expect(clusters[0].members).not.toContain(wallet3.toLowerCase());
  });

  it("cluster: cluster is deleted or emptied when fewer than 2 members remain", () => {
    // Only 1 wallet has this funder now
    const singleEdge: ClusterFundingEdgeInput[] = [
      { rootAddress: wallet1, rootChain: "base", parentAddress: sharedFunder, parentChain: "base", isTerminalEntity: false },
    ];

    const clusters = detectClustersFromEdges(singleEdge, statsMap);
    expect(clusters).toHaveLength(0);
  });

  it("cluster: detection is idempotent across repeated runs", () => {
    const edges: ClusterFundingEdgeInput[] = [
      { rootAddress: wallet1, rootChain: "base", parentAddress: sharedFunder, parentChain: "base", isTerminalEntity: false },
      { rootAddress: wallet2, rootChain: "base", parentAddress: sharedFunder, parentChain: "base", isTerminalEntity: false },
    ];

    const r1 = detectClustersFromEdges(edges, statsMap);
    const r2 = detectClustersFromEdges(edges, statsMap);

    expect(r1).toEqual(r2);
  });
});
