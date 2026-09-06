import { describe, it, expect, vi } from "vitest";
import { computeEdgeDecay } from "@/server/services/self/decay";
import type { Address } from "@/lib/chains/types";

vi.mock("@/server/db/client", () => ({
  prisma: {},
}));

describe("P5-T04: Edge decay curve", () => {
  const followedWalletA = "0x2222222222222222222222222222222222222222";
  const followedWalletB = "0x3333333333333333333333333333333333333333";

  it("decay: buckets trades by the FR-6.4 boundaries", async () => {
    // 4 trades spanning the 4 buckets: 0-1h, 1-6h, 6-24h, >24h
    const mockTrades = [
      {
        id: "t1",
        lagMinutes: 30,
        lagBucket: "0-1h",
        roiPct: "40.0",
        walletRoiPct: "50.0",
        followedWalletAddress: followedWalletA,
        followedWalletChain: "BASE",
      },
      {
        id: "t2",
        lagMinutes: 120,
        lagBucket: "1-6h",
        roiPct: "15.0",
        walletRoiPct: "30.0",
        followedWalletAddress: followedWalletA,
        followedWalletChain: "BASE",
      },
      {
        id: "t3",
        lagMinutes: 600,
        lagBucket: "6-24h",
        roiPct: "-5.0",
        walletRoiPct: "20.0",
        followedWalletAddress: followedWalletA,
        followedWalletChain: "BASE",
      },
      {
        id: "t4",
        lagMinutes: 2000,
        lagBucket: ">24h",
        roiPct: "-20.0",
        walletRoiPct: "10.0",
        followedWalletAddress: followedWalletA,
        followedWalletChain: "BASE",
      },
    ];

    const mockPrisma: any = {
      userTrade: {
        findMany: vi.fn().mockResolvedValue(mockTrades),
      },
    };

    const res = await computeEdgeDecay(
      { followedWallet: { address: followedWalletA as Address, chain: "base" }, minSample: 5 },
      mockPrisma
    );

    expect(res.buckets).toHaveLength(4);
    expect(res.buckets[0].bucket).toBe("0-1h");
    expect(res.buckets[0].tradeCount).toBe(1);
    expect(res.buckets[1].bucket).toBe("1-6h");
    expect(res.buckets[1].tradeCount).toBe(1);
    expect(res.buckets[2].bucket).toBe("6-24h");
    expect(res.buckets[2].tradeCount).toBe(1);
    expect(res.buckets[3].bucket).toBe(">24h");
    expect(res.buckets[3].tradeCount).toBe(1);
  });

  it("decay: average ROI computed per bucket", async () => {
    // 3 trades in the 0-1h bucket: ROI 50%, 20%, -10% => Avg = (50+20-10)/3 = 20.00%
    const mockTrades = [
      {
        id: "t1",
        lagMinutes: 15,
        lagBucket: "0-1h",
        roiPct: "50.0",
        walletRoiPct: "40.0",
        followedWalletAddress: followedWalletA,
      },
      {
        id: "t2",
        lagMinutes: 30,
        lagBucket: "0-1h",
        roiPct: "20.0",
        walletRoiPct: "30.0",
        followedWalletAddress: followedWalletA,
      },
      {
        id: "t3",
        lagMinutes: 45,
        lagBucket: "0-1h",
        roiPct: "-10.0",
        walletRoiPct: "10.0",
        followedWalletAddress: followedWalletA,
      },
    ];

    const mockPrisma: any = {
      userTrade: {
        findMany: vi.fn().mockResolvedValue(mockTrades),
      },
    };

    const res = await computeEdgeDecay({}, mockPrisma);
    const b0 = res.buckets.find((b) => b.bucket === "0-1h");
    expect(b0).toBeDefined();
    expect(b0?.tradeCount).toBe(3);
    expect(b0?.avgUserRoiPct).toBe("20.00");
    // Followed wallet avg ROI = (40+30+10)/3 = 26.67%
    expect(b0?.avgWalletRoiPct).toBe("26.67");
  });

  it("decay: win rate computed per bucket", async () => {
    // 4 trades in 1-6h: 3 winners (>0) and 1 loser (<0) => Win rate = 3/4 = 75.0%
    const mockTrades = [
      { id: "t1", lagMinutes: 90, lagBucket: "1-6h", roiPct: "10.0" },
      { id: "t2", lagMinutes: 100, lagBucket: "1-6h", roiPct: "25.0" },
      { id: "t3", lagMinutes: 120, lagBucket: "1-6h", roiPct: "5.0" },
      { id: "t4", lagMinutes: 150, lagBucket: "1-6h", roiPct: "-15.0" },
    ];

    const mockPrisma: any = {
      userTrade: {
        findMany: vi.fn().mockResolvedValue(mockTrades),
      },
    };

    const res = await computeEdgeDecay({}, mockPrisma);
    const b1 = res.buckets.find((b) => b.bucket === "1-6h");
    expect(b1).toBeDefined();
    expect(b1?.tradeCount).toBe(4);
    expect(b1?.winRatePct).toBe("75.0");
  });

  it("decay: empty bucket renders empty, not 0%", async () => {
    // Only 0-1h has trades; 1-6h, 6-24h, >24h are empty
    const mockTrades = [
      { id: "t1", lagMinutes: 20, lagBucket: "0-1h", roiPct: "30.0" },
    ];

    const mockPrisma: any = {
      userTrade: {
        findMany: vi.fn().mockResolvedValue(mockTrades),
      },
    };

    const res = await computeEdgeDecay({}, mockPrisma);
    const bEmpty = res.buckets.find((b) => b.bucket === "1-6h");
    expect(bEmpty).toBeDefined();
    expect(bEmpty?.tradeCount).toBe(0);
    expect(bEmpty?.avgUserRoiPct).toBeNull();
    expect(bEmpty?.avgWalletRoiPct).toBeNull();
    expect(bEmpty?.winRatePct).toBeNull();
  });

  it("decay: sampleSize below minimum sets insufficientSample", async () => {
    // 4 trades is below default minSample of 5
    const mockTrades = [
      { id: "t1", lagMinutes: 10, lagBucket: "0-1h", roiPct: "10.0" },
      { id: "t2", lagMinutes: 20, lagBucket: "0-1h", roiPct: "10.0" },
      { id: "t3", lagMinutes: 30, lagBucket: "0-1h", roiPct: "10.0" },
      { id: "t4", lagMinutes: 40, lagBucket: "0-1h", roiPct: "10.0" },
    ];

    const mockPrisma: any = {
      userTrade: {
        findMany: vi.fn().mockResolvedValue(mockTrades),
      },
    };

    const resBelow = await computeEdgeDecay({ minSample: 5 }, mockPrisma);
    expect(resBelow.sampleSize).toBe(4);
    expect(resBelow.insufficientSample).toBe(true);

    // 5 trades meets minSample
    const mockTrades5 = [...mockTrades, { id: "t5", lagMinutes: 50, lagBucket: "0-1h", roiPct: "10.0" }];
    const mockPrisma5: any = {
      userTrade: {
        findMany: vi.fn().mockResolvedValue(mockTrades5),
      },
    };

    const resAdequate = await computeEdgeDecay({ minSample: 5 }, mockPrisma5);
    expect(resAdequate.sampleSize).toBe(5);
    expect(resAdequate.insufficientSample).toBe(false);
  });

  it("decay: chart and table show identical numbers", async () => {
    const mockTrades = [
      { id: "t1", lagMinutes: 10, lagBucket: "0-1h", roiPct: "18.5" },
      { id: "t2", lagMinutes: 25, lagBucket: "0-1h", roiPct: "21.5" },
      { id: "t3", lagMinutes: 90, lagBucket: "1-6h", roiPct: "-5.0" },
    ];

    const mockPrisma: any = {
      userTrade: {
        findMany: vi.fn().mockResolvedValue(mockTrades),
      },
    };

    const res = await computeEdgeDecay({}, mockPrisma);

    // Both chart and table consumption relies on res.buckets
    const b0 = res.buckets[0];
    const tableUserRoi = b0.avgUserRoiPct;
    const tableWinRate = b0.winRatePct;
    const tableTrades = b0.tradeCount;

    // Derived chart point values
    const chartUserRoi = b0.avgUserRoiPct !== null ? Number(b0.avgUserRoiPct) : null;
    const chartWinRate = b0.winRatePct !== null ? Number(b0.winRatePct) : null;

    expect(chartUserRoi).toBe(20.0);
    expect(tableUserRoi).toBe("20.00");
    expect(chartWinRate).toBe(100.0);
    expect(tableWinRate).toBe("100.0");
    expect(tableTrades).toBe(2);
  });

  it("decay: per-followed-wallet filtering works", async () => {
    let capturedWhere: any = null;

    const mockPrisma: any = {
      userTrade: {
        findMany: vi.fn().mockImplementation(({ where }) => {
          capturedWhere = where;
          return [];
        }),
      },
    };

    await computeEdgeDecay(
      {
        followedWallet: { address: followedWalletA as Address, chain: "base" },
      },
      mockPrisma
    );

    expect(capturedWhere.followedWalletAddress).toBe(followedWalletA.toLowerCase());
    expect(capturedWhere.followedWalletChain).toBe("BASE");
  });
});
