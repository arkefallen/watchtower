import { describe, it, expect, vi } from "vitest";
import { computeSelfDashboard } from "@/server/services/self/dashboard";

vi.mock("@/server/db/client", () => ({
  prisma: {},
}));

describe("P5-T05: Personal dashboard", () => {
  const ownWalletAddress = "0x1111111111111111111111111111111111111111";
  const followedWalletA = "0x2222222222222222222222222222222222222222";
  const followedWalletB = "0x3333333333333333333333333333333333333333";
  const tokenAlpha = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
  const tokenBeta = "0x0578d8a44db98b23bf096a382e016e29a5ce0ffe";

  it("dashboard: win rate equals winning trades over closed trades", async () => {
    // 3 closed trades (2 winning, 1 losing) + 1 open trade (no exit/roi)
    const trades = [
      {
        id: "t1",
        ownWalletAddress,
        ownChain: "BASE",
        tokenAddress: tokenAlpha,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "1000",
        entryAt: new Date("2026-03-01T10:00:00.000Z"),
        exitAt: new Date("2026-03-01T12:00:00.000Z"),
        roiPct: "20.0", // Winner
        followedWalletAddress: null,
      },
      {
        id: "t2",
        ownWalletAddress,
        ownChain: "BASE",
        tokenAddress: tokenAlpha,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "1000",
        entryAt: new Date("2026-03-02T10:00:00.000Z"),
        exitAt: new Date("2026-03-02T12:00:00.000Z"),
        roiPct: "10.0", // Winner
        followedWalletAddress: null,
      },
      {
        id: "t3",
        ownWalletAddress,
        ownChain: "BASE",
        tokenAddress: tokenBeta,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "1000",
        entryAt: new Date("2026-03-03T10:00:00.000Z"),
        exitAt: new Date("2026-03-03T12:00:00.000Z"),
        roiPct: "-15.0", // Loser
        followedWalletAddress: null,
      },
      {
        id: "t4",
        ownWalletAddress,
        ownChain: "BASE",
        tokenAddress: tokenBeta,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "1000",
        entryAt: new Date("2026-03-04T10:00:00.000Z"),
        exitAt: null,
        roiPct: null, // Open trade
        followedWalletAddress: null,
      },
    ];

    const mockPrisma: any = {
      userTrade: {
        findMany: vi.fn().mockResolvedValue(trades),
      },
      position: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const res = await computeSelfDashboard({}, mockPrisma);
    // Closed trades = 3, Winning = 2 -> 2/3 = 66.7%
    expect(res.winRatePct).toBe("66.7");
    expect(res.totalTradesCount).toBe(4);
  });

  it("dashboard: total PnL sums realized results", async () => {
    // 2 trades: $1,000 at +30% (+$300) and $2,000 at -10% (-$200) => net realized $100.00
    const trades = [
      {
        id: "t1",
        ownWalletAddress,
        ownChain: "BASE",
        tokenAddress: tokenAlpha,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "1000",
        entryAt: new Date("2026-03-01T10:00:00.000Z"),
        exitAt: new Date("2026-03-01T12:00:00.000Z"),
        roiPct: "30.0",
        followedWalletAddress: null,
      },
      {
        id: "t2",
        ownWalletAddress,
        ownChain: "BASE",
        tokenAddress: tokenBeta,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "2000",
        entryAt: new Date("2026-03-02T10:00:00.000Z"),
        exitAt: new Date("2026-03-02T12:00:00.000Z"),
        roiPct: "-10.0",
        followedWalletAddress: null,
      },
    ];

    const mockPrisma: any = {
      userTrade: {
        findMany: vi.fn().mockResolvedValue(trades),
      },
      position: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const res = await computeSelfDashboard({}, mockPrisma);
    expect(res.totalPnlUsd).toBe("100.00");
  });

  it("dashboard: open positions are excluded from realized PnL", async () => {
    // Closed position: cost $1000, realized $1500 -> realized PnL = +500
    // Open position: cost $2000, unrealized $400 -> unrealized PnL = +400, realized = 0
    const positions = [
      {
        id: "p1",
        walletAddress: ownWalletAddress,
        walletChain: "BASE",
        tokenAddress: tokenAlpha,
        tokenChain: "BASE",
        isOpen: false,
        costUsd: "1000",
        realizedUsd: "1500",
        unrealizedUsd: "0",
        token: { symbol: "ALPHA" },
      },
      {
        id: "p2",
        walletAddress: ownWalletAddress,
        walletChain: "BASE",
        tokenAddress: tokenBeta,
        tokenChain: "BASE",
        isOpen: true,
        costUsd: "2000",
        realizedUsd: "0",
        unrealizedUsd: "400",
        token: { symbol: "BETA" },
      },
    ];

    const mockPrisma: any = {
      userTrade: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      position: {
        findMany: vi.fn().mockResolvedValue(positions),
      },
    };

    const res = await computeSelfDashboard({}, mockPrisma);
    // Realized PnL must only be +500.00 (open position excluded)
    expect(res.totalPnlUsd).toBe("500.00");
    // Unrealized PnL must be +400.00
    expect(res.unrealizedPnlUsd).toBe("400.00");
  });

  it("dashboard: PnL by followed wallet aggregates correctly", async () => {
    const trades = [
      {
        id: "t1",
        ownWalletAddress,
        ownChain: "BASE",
        tokenAddress: tokenAlpha,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "1000",
        entryAt: new Date("2026-03-01T10:00:00.000Z"),
        exitAt: new Date("2026-03-01T12:00:00.000Z"),
        roiPct: "20.0", // +$200
        followedWalletAddress: followedWalletA,
        followedWalletChain: "BASE",
        lagMinutes: 30,
        followedWallet: { label: "Alpha Whale" },
      },
      {
        id: "t2",
        ownWalletAddress,
        ownChain: "BASE",
        tokenAddress: tokenAlpha,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "1000",
        entryAt: new Date("2026-03-02T10:00:00.000Z"),
        exitAt: new Date("2026-03-02T12:00:00.000Z"),
        roiPct: "10.0", // +$100
        followedWalletAddress: followedWalletA,
        followedWalletChain: "BASE",
        lagMinutes: 60,
        followedWallet: { label: "Alpha Whale" },
      },
      {
        id: "t3",
        ownWalletAddress,
        ownChain: "BASE",
        tokenAddress: tokenBeta,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "500",
        entryAt: new Date("2026-03-03T10:00:00.000Z"),
        exitAt: new Date("2026-03-03T12:00:00.000Z"),
        roiPct: "-20.0", // -$100
        followedWalletAddress: followedWalletB,
        followedWalletChain: "BASE",
        lagMinutes: 90,
        followedWallet: { label: "Beta Sniper" },
      },
    ];

    const mockPrisma: any = {
      userTrade: {
        findMany: vi.fn().mockResolvedValue(trades),
      },
      position: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const res = await computeSelfDashboard({}, mockPrisma);
    expect(res.byFollowedWallet).toHaveLength(2);

    const fA = res.byFollowedWallet.find((w) => w.address === followedWalletA.toLowerCase());
    expect(fA).toBeDefined();
    expect(fA?.tradeCount).toBe(2);
    expect(fA?.pnlUsd).toBe("300.00");
    // Avg lag = (30 + 60) / 2 = 45 min
    expect(fA?.avgLagMinutes).toBe(45);

    const fB = res.byFollowedWallet.find((w) => w.address === followedWalletB.toLowerCase());
    expect(fB).toBeDefined();
    expect(fB?.tradeCount).toBe(1);
    expect(fB?.pnlUsd).toBe("-100.00");
    expect(fB?.avgLagMinutes).toBe(90);
  });

  it("dashboard: PnL by token aggregates correctly", async () => {
    const trades = [
      {
        id: "t1",
        ownWalletAddress,
        ownChain: "BASE",
        tokenAddress: tokenAlpha,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "1000",
        entryAt: new Date("2026-03-01T10:00:00.000Z"),
        exitAt: new Date("2026-03-01T12:00:00.000Z"),
        roiPct: "25.0", // +$250
        followedWalletAddress: null,
        token: { symbol: "ALPHA" },
      },
      {
        id: "t2",
        ownWalletAddress,
        ownChain: "BASE",
        tokenAddress: tokenAlpha,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "1000",
        entryAt: new Date("2026-03-02T10:00:00.000Z"),
        exitAt: new Date("2026-03-02T12:00:00.000Z"),
        roiPct: "5.0", // +$50
        followedWalletAddress: null,
        token: { symbol: "ALPHA" },
      },
      {
        id: "t3",
        ownWalletAddress,
        ownChain: "BASE",
        tokenAddress: tokenBeta,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "1000",
        entryAt: new Date("2026-03-03T10:00:00.000Z"),
        exitAt: new Date("2026-03-03T12:00:00.000Z"),
        roiPct: "-10.0", // -$100
        followedWalletAddress: null,
        token: { symbol: "BETA" },
      },
    ];

    const mockPrisma: any = {
      userTrade: {
        findMany: vi.fn().mockResolvedValue(trades),
      },
      position: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const res = await computeSelfDashboard({}, mockPrisma);
    const alphaToken = res.byToken.find((t) => t.tokenAddress === tokenAlpha.toLowerCase());
    expect(alphaToken).toBeDefined();
    expect(alphaToken?.tradeCount).toBe(2);
    expect(alphaToken?.pnlUsd).toBe("300.00");

    const betaToken = res.byToken.find((t) => t.tokenAddress === tokenBeta.toLowerCase());
    expect(betaToken).toBeDefined();
    expect(betaToken?.tradeCount).toBe(1);
    expect(betaToken?.pnlUsd).toBe("-100.00");
  });

  it("dashboard: PnL by lag bucket matches the decay table", async () => {
    const trades = [
      {
        id: "t1",
        ownWalletAddress,
        ownChain: "BASE",
        tokenAddress: tokenAlpha,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "1000",
        entryAt: new Date("2026-03-01T10:00:00.000Z"),
        exitAt: new Date("2026-03-01T12:00:00.000Z"),
        roiPct: "30.0",
        followedWalletAddress: followedWalletA,
        followedWalletChain: "BASE",
        lagMinutes: 20,
        lagBucket: "0-1h",
      },
      {
        id: "t2",
        ownWalletAddress,
        ownChain: "BASE",
        tokenAddress: tokenAlpha,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "1000",
        entryAt: new Date("2026-03-01T10:00:00.000Z"),
        exitAt: new Date("2026-03-01T12:00:00.000Z"),
        roiPct: "10.0",
        followedWalletAddress: followedWalletA,
        followedWalletChain: "BASE",
        lagMinutes: 120,
        lagBucket: "1-6h",
      },
    ];

    const mockPrisma: any = {
      userTrade: {
        findMany: vi.fn().mockResolvedValue(trades),
      },
      position: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const res = await computeSelfDashboard({}, mockPrisma);
    expect(res.byLagBucket).toHaveLength(4);

    const b0 = res.byLagBucket.find((b) => b.bucket === "0-1h");
    expect(b0?.tradeCount).toBe(1);
    expect(b0?.avgUserRoiPct).toBe("30.00");

    const b1 = res.byLagBucket.find((b) => b.bucket === "1-6h");
    expect(b1?.tradeCount).toBe(1);
    expect(b1?.avgUserRoiPct).toBe("10.00");
  });

  it("dashboard: zero trades renders a defined empty state", async () => {
    const mockPrisma: any = {
      userTrade: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      position: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const res = await computeSelfDashboard({}, mockPrisma);
    expect(res.totalTradesCount).toBe(0);
    expect(res.linkedTradesCount).toBe(0);
    expect(res.totalPnlUsd).toBe("0.00");
    expect(res.unrealizedPnlUsd).toBe("0.00");
    expect(res.winRatePct).toBe("0.0");
    expect(res.avgFollowLagMinutes).toBeNull();
    expect(res.byFollowedWallet).toHaveLength(0);
    expect(res.byToken).toHaveLength(0);
    expect(res.byLagBucket).toHaveLength(4);
  });
});
