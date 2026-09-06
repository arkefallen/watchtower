import { describe, it, expect, vi } from "vitest";
import {
  deriveComparisonVerdict,
  getTradeComparisonList,
} from "@/server/services/self/comparison";
import type { Address } from "@/lib/chains/types";

vi.mock("@/server/db/client", () => ({
  prisma: {},
}));

describe("P5-T06: Comparison view", () => {
  const ownWalletAddress = "0x1111111111111111111111111111111111111111";
  const followedWallet = "0x2222222222222222222222222222222222222222";
  const tokenAddress = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

  it("comparison: renders user and wallet ROI per linked trade", async () => {
    const trades = [
      {
        id: "trade-1",
        entryAt: new Date("2026-03-01T12:00:00.000Z"),
        tokenAddress,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "1500.00",
        followedWalletAddress: followedWallet,
        followedWalletChain: "BASE",
        lagMinutes: 45,
        lagBucket: "0-1h",
        lagMcDelta: "250000.00",
        roiPct: "35.5",
        walletRoiPct: "30.0",
        isLinkPinned: false,
        thesis: "Rider follow",
        token: { symbol: "ALPHA" },
        followedWallet: { label: "Smart Alpha" },
        ownWallet: { isSelf: true },
      },
    ];

    const mockPrisma: any = {
      userTrade: {
        findMany: vi.fn().mockResolvedValue(trades),
      },
    };

    const items = await getTradeComparisonList({}, mockPrisma);
    expect(items).toHaveLength(1);
    const item = items[0];

    expect(item.userRoiPct).toBe("35.5");
    expect(item.walletRoiPct).toBe("30.0");
    expect(item.roiGapPct).toBe("5.50");
    expect(item.lagMinutes).toBe(45);
    expect(item.lagMcDelta).toBe("250000.00");
    expect(item.followedWalletAddress).toBe(followedWallet.toLowerCase());
  });

  it("comparison: captured when user ROI >= wallet ROI", () => {
    // User ROI strictly greater
    expect(deriveComparisonVerdict("25.0", "15.0")).toBe("CAPTURED");
    // User ROI equal
    expect(deriveComparisonVerdict("20.0", "20.0")).toBe("CAPTURED");
    // Negative ROIs where user lost less (e.g. user -5% vs wallet -10%)
    expect(deriveComparisonVerdict("-5.0", "-10.0")).toBe("CAPTURED");
  });

  it("comparison: decayed when user ROI < wallet ROI", () => {
    // User arrived late and made less
    expect(deriveComparisonVerdict("10.0", "45.0")).toBe("DECAYED");
    // Wallet profited while user lost
    expect(deriveComparisonVerdict("-15.0", "20.0")).toBe("DECAYED");
  });

  it("comparison: unknown wallet ROI renders an em dash with no verdict", async () => {
    // Verdict should be null when either ROI is null
    expect(deriveComparisonVerdict("25.0", null)).toBeNull();
    expect(deriveComparisonVerdict(null, "30.0")).toBeNull();
    expect(deriveComparisonVerdict(null, null)).toBeNull();

    const trades = [
      {
        id: "trade-unknown-wallet-roi",
        entryAt: new Date("2026-03-01T12:00:00.000Z"),
        tokenAddress,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "1000.00",
        followedWalletAddress: followedWallet,
        followedWalletChain: "BASE",
        lagMinutes: 20,
        lagBucket: "0-1h",
        lagMcDelta: null,
        roiPct: "15.0",
        walletRoiPct: null, // Wallet ROI unknown (e.g. wallet still holding)
        isLinkPinned: false,
        thesis: null,
        token: { symbol: "ALPHA" },
        followedWallet: null,
        ownWallet: { isSelf: true },
      },
    ];

    const mockPrisma: any = {
      userTrade: {
        findMany: vi.fn().mockResolvedValue(trades),
      },
    };

    const items = await getTradeComparisonList({}, mockPrisma);
    expect(items).toHaveLength(1);
    expect(items[0].walletRoiPct).toBeNull();
    expect(items[0].verdict).toBeNull();
    expect(items[0].roiGapPct).toBeNull();
  });

  it("comparison: sortable by lag and by ROI gap", async () => {
    const trades = [
      {
        id: "trade-a",
        entryAt: new Date("2026-03-01T10:00:00.000Z"),
        tokenAddress,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "1000",
        followedWalletAddress: followedWallet,
        lagMinutes: 120,
        roiPct: "10.0",
        walletRoiPct: "30.0", // roiGap = 10 - 30 = -20
      },
      {
        id: "trade-b",
        entryAt: new Date("2026-03-02T10:00:00.000Z"),
        tokenAddress,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "1000",
        followedWalletAddress: followedWallet,
        lagMinutes: 15,
        roiPct: "50.0",
        walletRoiPct: "40.0", // roiGap = 50 - 40 = +10
      },
      {
        id: "trade-c",
        entryAt: new Date("2026-03-03T10:00:00.000Z"),
        tokenAddress,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "1000",
        followedWalletAddress: followedWallet,
        lagMinutes: 45,
        roiPct: "20.0",
        walletRoiPct: "20.0", // roiGap = 0
      },
    ];

    const mockPrisma: any = {
      userTrade: {
        findMany: vi.fn().mockResolvedValue(trades),
      },
    };

    // Sort by lag ascending: should be trade-b (15m), trade-c (45m), trade-a (120m)
    const sortedByLagAsc = await getTradeComparisonList(
      { sortBy: "lagMinutes", sortOrder: "asc" },
      mockPrisma
    );
    expect(sortedByLagAsc.map((t) => t.id)).toEqual(["trade-b", "trade-c", "trade-a"]);

    // Sort by lag descending: trade-a (120m), trade-c (45m), trade-b (15m)
    const sortedByLagDesc = await getTradeComparisonList(
      { sortBy: "lagMinutes", sortOrder: "desc" },
      mockPrisma
    );
    expect(sortedByLagDesc.map((t) => t.id)).toEqual(["trade-a", "trade-c", "trade-b"]);

    // Sort by ROI gap descending: trade-b (+10), trade-c (0), trade-a (-20)
    const sortedByGapDesc = await getTradeComparisonList(
      { sortBy: "roiGap", sortOrder: "desc" },
      mockPrisma
    );
    expect(sortedByGapDesc.map((t) => t.id)).toEqual(["trade-b", "trade-c", "trade-a"]);

    // Sort by ROI gap ascending: trade-a (-20), trade-c (0), trade-b (+10)
    const sortedByGapAsc = await getTradeComparisonList(
      { sortBy: "roiGap", sortOrder: "asc" },
      mockPrisma
    );
    expect(sortedByGapAsc.map((t) => t.id)).toEqual(["trade-a", "trade-c", "trade-b"]);
  });
});
