import { describe, it, expect, vi } from "vitest";
import {
  ManualTradeSchema,
  addTrade,
  updateTrade,
  UpdateTradeSchema,
} from "@/server/services/self/trades";
import { computeSelfDashboard } from "@/server/services/self/dashboard";

vi.mock("@/server/db/client", () => ({
  prisma: {},
}));

describe("P5-T03: Manual trade log with required thesis", () => {
  const ownWalletAddress = "0x1111111111111111111111111111111111111111";
  const tokenAddress = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
  const followedAddress = "0x2222222222222222222222222222222222222222";

  it("manual-trade: empty thesis is rejected server-side", () => {
    const input = {
      ownWalletAddress,
      ownChain: "base" as const,
      tokenAddress,
      tokenChain: "base" as const,
      side: "BUY" as const,
      amountUsd: "500.00",
      entryAt: new Date("2026-03-01T10:00:00.000Z"),
      source: "MANUAL" as const,
      thesis: "",
    };

    const result = ManualTradeSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("thesis"));
      expect(issue).toBeDefined();
      expect(issue?.message).toContain("Thesis is required for manual trades");
    }
  });

  it("manual-trade: whitespace-only thesis is rejected", () => {
    const input = {
      ownWalletAddress,
      ownChain: "base" as const,
      tokenAddress,
      tokenChain: "base" as const,
      side: "BUY" as const,
      amountUsd: "500.00",
      entryAt: new Date("2026-03-01T10:00:00.000Z"),
      source: "MANUAL" as const,
      thesis: "   \t \n  ",
    };

    const result = ManualTradeSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("thesis"));
      expect(issue).toBeDefined();
      expect(issue?.message).toContain("Thesis is required for manual trades");
    }
  });

  it("manual-trade: AUTO trades do not require a thesis", () => {
    const input = {
      ownWalletAddress,
      ownChain: "base" as const,
      tokenAddress,
      tokenChain: "base" as const,
      side: "BUY" as const,
      amountUsd: "500.00",
      entryAt: new Date("2026-03-01T10:00:00.000Z"),
      source: "AUTO" as const,
      thesis: "",
    };

    const result = ManualTradeSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("manual-trade: explicit followedWallet sets isLinkPinned", async () => {
    const tradeEntry = new Date("2026-03-01T12:00:00.000Z");
    const walletEntry = new Date("2026-03-01T11:15:00.000Z"); // 45 min lag

    let createdTradeData: any = null;
    const mockPrisma: any = {
      token: {
        upsert: vi.fn().mockResolvedValue({}),
      },
      wallet: {
        upsert: vi.fn().mockResolvedValue({}),
      },
      movementEvent: {
        findFirst: vi.fn().mockResolvedValue({
          timestamp: walletEntry,
          amountUsd: "2500",
          marketCapAtAction: "5000000",
        }),
      },
      position: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      userTrade: {
        create: vi.fn().mockImplementation(({ data }) => {
          createdTradeData = data;
          return { id: "trade-manual-1", ...data };
        }),
        findUnique: vi.fn().mockImplementation(() => ({
          id: "trade-manual-1",
          ...createdTradeData,
          ownWallet: { address: ownWalletAddress, isSelf: true },
          followedWallet: { address: followedAddress },
          token: { address: tokenAddress, symbol: "TOKEN" },
        })),
      },
    };

    const result = await addTrade(
      {
        ownWalletAddress,
        ownChain: "base",
        tokenAddress,
        tokenChain: "base",
        side: "BUY",
        amountUsd: "1000",
        entryAt: tradeEntry,
        source: "MANUAL",
        thesis: "High-conviction accumulation observed onchain",
        followedWalletAddress: followedAddress,
        followedWalletChain: "base",
      },
      mockPrisma
    );

    expect(createdTradeData.isLinkPinned).toBe(true);
    expect(createdTradeData.followedWalletAddress).toBe(followedAddress.toLowerCase());
    expect(createdTradeData.lagMinutes).toBe(45);
    expect(createdTradeData.lagBucket).toBe("0-1h");
    expect(createdTradeData.thesis).toBe("High-conviction accumulation observed onchain");
  });

  it("manual-trade: appears in dashboard aggregates", async () => {
    const manualTrades = [
      {
        id: "m-trade-1",
        ownWalletAddress,
        ownChain: "BASE",
        tokenAddress,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "1000",
        entryAt: new Date("2026-03-01T10:00:00.000Z"),
        exitAt: new Date("2026-03-01T18:00:00.000Z"),
        roiPct: "25.0", // Realized gain: 1000 * 0.25 = +250
        source: "MANUAL",
        thesis: "Early breakout signal",
        isLinkPinned: false,
        followedWalletAddress: null,
        followedWalletChain: null,
        lagMinutes: null,
        lagBucket: null,
        token: { symbol: "ALPHA" },
        ownWallet: { isSelf: true },
        followedWallet: null,
      },
      {
        id: "m-trade-2",
        ownWalletAddress,
        ownChain: "BASE",
        tokenAddress,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "500",
        entryAt: new Date("2026-03-02T10:00:00.000Z"),
        exitAt: new Date("2026-03-02T16:00:00.000Z"),
        roiPct: "-10.0", // Realized loss: 500 * -0.10 = -50
        source: "MANUAL",
        thesis: "Dip buy on support",
        isLinkPinned: false,
        followedWalletAddress: null,
        followedWalletChain: null,
        lagMinutes: null,
        lagBucket: null,
        token: { symbol: "ALPHA" },
        ownWallet: { isSelf: true },
        followedWallet: null,
      },
    ];

    const mockPrisma: any = {
      userTrade: {
        findMany: vi.fn().mockResolvedValue(manualTrades),
      },
      position: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const dashboard = await computeSelfDashboard({}, mockPrisma);
    expect(dashboard.totalTradesCount).toBe(2);
    // Net PnL = 250 - 50 = 200.00
    expect(dashboard.totalPnlUsd).toBe("200.00");
    // Win rate = 1 winning trade / 2 closed trades = 50.0%
    expect(dashboard.winRatePct).toBe("50.0");
    // By token ALPHA should have 2 trades and 200.00 PnL
    const tokenSummary = dashboard.byToken.find((t) => t.tokenAddress === tokenAddress.toLowerCase());
    expect(tokenSummary).toBeDefined();
    expect(tokenSummary?.tradeCount).toBe(2);
    expect(tokenSummary?.pnlUsd).toBe("200.00");
  });

  it("manual-trade: update preserves the pinned link", async () => {
    const existingTrade = {
      id: "trade-pinned-1",
      ownWalletAddress,
      ownChain: "BASE",
      tokenAddress,
      tokenChain: "BASE",
      side: "BUY",
      amountUsd: "1000",
      entryAt: new Date("2026-03-01T10:00:00.000Z"),
      exitAt: null,
      roiPct: null,
      followedWalletAddress: followedAddress.toLowerCase(),
      followedWalletChain: "BASE",
      isLinkPinned: true,
      source: "MANUAL",
      thesis: "Initial thesis",
      lagMinutes: 30,
      lagBucket: "0-1h",
      walletRoiPct: "15.0",
      entryMarketCap: "10000000",
    };

    let updatedData: any = null;
    const mockPrisma: any = {
      userTrade: {
        findUnique: vi.fn().mockResolvedValue(existingTrade),
        update: vi.fn().mockImplementation(({ data }) => {
          updatedData = data;
          return { ...existingTrade, ...data };
        }),
      },
    };

    // Update only the thesis and ROI without touching followed wallet
    const updated = await updateTrade(
      {
        id: "trade-pinned-1",
        thesis: "Updated narrative thesis after confirmation",
        roiPct: "42.0",
      },
      mockPrisma
    );

    expect(updatedData.isLinkPinned).toBe(true);
    expect(updatedData.followedWalletAddress).toBe(followedAddress.toLowerCase());
    expect(updatedData.thesis).toBe("Updated narrative thesis after confirmation");
    expect(updatedData.roiPct).toBe("42.0");
  });
});
