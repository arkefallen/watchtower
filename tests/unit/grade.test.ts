import { describe, it, expect, vi } from "vitest";
import {
  calculateWalletGrade,
  computeAndPersistWalletGrade,
  type WalletGradePositionInput,
} from "@/server/services/wallet/grade";

describe("P6-T01: Auto-grade computation", () => {
  const sampleWalletTags = {
    edgeTag: "SMART",
    styleTag: "RIDER",
    sizeTag: "W",
  };

  it("grade: win rate equals profitable over closed positions", () => {
    // 10 closed positions: 6 profitable (>0), 4 loss/breakeven (<=0)
    const positions: WalletGradePositionInput[] = [
      { isOpen: false, realizedUsd: 1200 },
      { isOpen: false, realizedUsd: 850 },
      { isOpen: false, realizedUsd: 400 },
      { isOpen: false, realizedUsd: 150 },
      { isOpen: false, realizedUsd: 3000 },
      { isOpen: false, realizedUsd: 50 },
      { isOpen: false, realizedUsd: -500 },
      { isOpen: false, realizedUsd: -250 },
      { isOpen: false, realizedUsd: -120 },
      { isOpen: false, realizedUsd: 0 },
    ];

    const result = calculateWalletGrade(positions, sampleWalletTags, { minSampleSize: 3 });

    expect(result.available).toBe(true);
    expect(result.closedPositionsCount).toBe(10);
    expect(result.profitablePositionsCount).toBe(6);
    expect(result.winRate).toBe(0.6);
    expect(result.winRatePct).toBe(60);
  });

  it("grade: realized PnL sums closed positions only", () => {
    // 3 closed positions (sum = $1000 - $300 + $50 = $750) and 2 open positions ($5000)
    const positions: WalletGradePositionInput[] = [
      { isOpen: false, realizedUsd: 1000 },
      { isOpen: false, realizedUsd: -300 },
      { isOpen: false, realizedUsd: 50 },
      { isOpen: true, realizedUsd: 5000 }, // Open position - must be excluded!
      { isOpen: true, realizedUsd: -2000 }, // Open position - must be excluded!
    ];

    const result = calculateWalletGrade(positions, sampleWalletTags, { minSampleSize: 3 });

    expect(result.available).toBe(true);
    expect(result.closedPositionsCount).toBe(3);
    expect(result.realizedPnlUsd).toBe("750.00");
  });

  it("grade: entry-timing ratio uses entry market cap over peak market cap", () => {
    // Position 1: Entry MC = 10M, Peak MC = 50M -> ratio = 0.2
    // Position 2: Entry MC = 25M, Peak MC = 100M -> ratio = 0.25
    // Average ratio = (0.2 + 0.25) / 2 = 0.225
    const positions: WalletGradePositionInput[] = [
      { isOpen: false, realizedUsd: 500, entryMarketCap: 10_000_000, peakMarketCap: 50_000_000 },
      { isOpen: false, realizedUsd: 1200, entryMarketCap: 25_000_000, peakMarketCap: 100_000_000 },
      { isOpen: false, realizedUsd: -100, entryMarketCap: 5_000_000, peakMarketCap: 10_000_000 }, // ratio = 0.5
    ];

    // Average = (0.2 + 0.25 + 0.5) / 3 = 0.31666... -> 0.317
    const result = calculateWalletGrade(positions, sampleWalletTags, { minSampleSize: 3 });

    expect(result.available).toBe(true);
    expect(result.entryTimingRatio).toBe(0.317);
    expect(result.entryTimingRatio).toBeGreaterThan(0);
    expect(result.entryTimingRatio).toBeLessThanOrEqual(1);
  });

  it("grade: below minimum sample reports unavailable", () => {
    // Only 2 closed positions when minimum sample size is 5 (or 3)
    const positions: WalletGradePositionInput[] = [
      { isOpen: false, realizedUsd: 1000 },
      { isOpen: false, realizedUsd: 200 },
    ];

    const result = calculateWalletGrade(positions, sampleWalletTags, { minSampleSize: 3 });

    expect(result.available).toBe(false);
    expect(result.winRate).toBeNull();
    expect(result.winRatePct).toBeNull();
    expect(result.realizedPnlUsd).toBeNull();
    expect(result.entryTimingRatio).toBeNull();
    expect(result.unavailableReason).toBe("INSUFFICIENT_SAMPLE");
    expect(result.sampleSize).toBe(2);
  });

  it("grade: recompute is idempotent", async () => {
    const mockUpsert = vi.fn().mockResolvedValue({});
    const mockFindUnique = vi.fn().mockResolvedValue({
      edgeTag: "SMART",
      styleTag: "RIDER",
      sizeTag: "W",
    });
    const mockFindMany = vi.fn().mockResolvedValue([
      {
        isOpen: false,
        realizedUsd: "500",
        entryMarketCap: "10000000",
        avgEntryPriceUsd: null,
        peakPriceUsd: null,
        token: { latestMarketCap: "50000000" },
      },
      {
        isOpen: false,
        realizedUsd: "1500",
        entryMarketCap: "20000000",
        avgEntryPriceUsd: null,
        peakPriceUsd: null,
        token: { latestMarketCap: "40000000" },
      },
      {
        isOpen: false,
        realizedUsd: "-200",
        entryMarketCap: "5000000",
        avgEntryPriceUsd: null,
        peakPriceUsd: null,
        token: { latestMarketCap: "10000000" },
      },
    ]);

    const mockPrisma = {
      wallet: { findUnique: mockFindUnique },
      position: { findMany: mockFindMany },
      walletProfile: { upsert: mockUpsert },
    } as any;

    const opt = {
      walletAddress: "0x1234567890123456789012345678901234567890",
      chain: "base" as const,
      minSampleSize: 3,
    };

    const res1 = await computeAndPersistWalletGrade(opt, mockPrisma);
    const res2 = await computeAndPersistWalletGrade(opt, mockPrisma);

    expect(res1.available).toBe(true);
    expect(res2.available).toBe(true);
    expect(res1.winRate).toEqual(res2.winRate);
    expect(res1.realizedPnlUsd).toEqual(res2.realizedPnlUsd);
    expect(res1.entryTimingRatio).toEqual(res2.entryTimingRatio);
    expect(res1.gradeLabel).toEqual(res2.gradeLabel);
    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });

  it("grade: gradeLabel matches the FR-1.6 computed label", () => {
    const positions: WalletGradePositionInput[] = [
      { isOpen: false, realizedUsd: 100 },
      { isOpen: false, realizedUsd: 200 },
      { isOpen: false, realizedUsd: 300 },
    ];

    const resWithTags = calculateWalletGrade(
      positions,
      { edgeTag: "SMART", styleTag: "RIDER", sizeTag: "W" },
      { minSampleSize: 3 }
    );
    expect(resWithTags.gradeLabel).toBe("SMART-RIDER [W]");

    const resEdgeOnly = calculateWalletGrade(
      positions,
      { edgeTag: "INSIDER" },
      { minSampleSize: 3 }
    );
    expect(resEdgeOnly.gradeLabel).toBe("INSIDER");

    const resNoTags = calculateWalletGrade(positions, {}, { minSampleSize: 3 });
    expect(resNoTags.gradeLabel).toBeNull();
  });
});
