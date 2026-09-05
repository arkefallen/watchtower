import { describe, expect, it, vi } from "vitest";
import { computeHeatmaps, getZonedTimeParts } from "@/server/services/wallet/heatmap";
import { computeWalletProfile, type ProfileTxInput } from "@/server/services/wallet/profile";
import type { Address } from "@/lib/chains/types";

describe("P1-T06: Wallet Profile Statistics & Heatmaps", () => {
  const sampleWallet = "0x1111111111111111111111111111111111111111" as Address;
  const usdcAddress = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913".toLowerCase();
  const pepeAddress = "0x2222222222222222222222222222222222222222".toLowerCase();
  const flokiAddress = "0x3333333333333333333333333333333333333333".toLowerCase();

  it("profile: habitual heatmap has 7×24 cells summing to full-history txCount", () => {
    const timestamps = [
      new Date("2026-01-01T10:00:00Z"),
      new Date("2026-01-02T15:00:00Z"),
      new Date("2026-01-03T20:00:00Z"),
    ];

    const heatmaps = computeHeatmaps(timestamps, "UTC", new Date("2026-01-04T00:00:00Z"));
    expect(heatmaps.habitual).toHaveLength(7);
    for (const row of heatmaps.habitual) {
      expect(row).toHaveLength(24);
    }
    const sum = heatmaps.habitual.reduce(
      (acc, row) => acc + row.reduce((rAcc, cell) => rAcc + cell, 0),
      0
    );
    expect(sum).toBe(3);
  });

  it("profile: recent heatmap has 7×24 cells and excludes events before the rolling window", () => {
    const now = new Date("2026-01-10T12:00:00Z");
    const timestamps = [
      new Date("2025-12-01T10:00:00Z"), // outside 7 days
      new Date("2026-01-08T10:00:00Z"), // inside 7 days
      new Date("2026-01-09T15:00:00Z"), // inside 7 days
    ];

    const heatmaps = computeHeatmaps(timestamps, "UTC", now);
    expect(heatmaps.recent7d).toHaveLength(7);
    for (const row of heatmaps.recent7d) {
      expect(row).toHaveLength(24);
    }
    const recentSum = heatmaps.recent7d.reduce(
      (acc, row) => acc + row.reduce((rAcc, cell) => rAcc + cell, 0),
      0
    );
    expect(recentSum).toBe(2);
  });

  it("profile: both modes bucket by APP_TIMEZONE local hour and weekday/date", () => {
    // 2026-01-01T00:00:00Z in Asia/Jakarta (UTC+7) is 2026-01-01 07:00:00 (Thursday)
    const dt = new Date("2026-01-01T00:00:00Z");
    const parts = getZonedTimeParts(dt, "Asia/Jakarta");
    expect(parts.hour).toBe(7);
    expect(parts.dayOfWeek).toBe(4); // Thursday

    const heatmaps = computeHeatmaps([dt], "Asia/Jakarta", new Date("2026-01-02T00:00:00Z"));
    expect(heatmaps.habitual[4][7]).toBe(1);
    expect(heatmaps.timezone).toBe("Asia/Jakarta");
  });

  it("profile: DST/local-date window boundaries are explicit", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    const heatmaps = computeHeatmaps([], "America/New_York", now);
    expect(heatmaps.recentWindow).toBeDefined();
    expect(new Date(heatmaps.recentWindow.end).getTime()).toBeGreaterThan(
      new Date(heatmaps.recentWindow.start).getTime()
    );
  });

  it("profile: firstTxAt equals the earliest ingested timestamp", () => {
    const txs: ProfileTxInput[] = [
      {
        timestamp: new Date("2025-06-01T10:00:00Z"),
        tokenAddress: null,
        isError: false,
      },
      {
        timestamp: new Date("2025-01-15T10:00:00Z"), // earliest
        tokenAddress: null,
        isError: false,
      },
      {
        timestamp: new Date("2025-09-01T10:00:00Z"),
        tokenAddress: pepeAddress,
        isError: false,
      },
    ];

    const stats = computeWalletProfile({
      walletAddress: sampleWallet,
      chain: "base",
      transactions: txs,
      stableTokens: [usdcAddress],
      timezone: "UTC",
      now: new Date("2025-10-01T00:00:00Z"),
      dormancyDays: 30,
    });

    expect(stats.firstTxAt).toEqual(new Date("2025-01-15T10:00:00Z"));
    expect(stats.txCount).toBe(3);
  });

  it("profile: distinctTokenCount excludes stables and native", () => {
    const txs: ProfileTxInput[] = [
      { timestamp: new Date("2025-01-01T00:00:00Z"), tokenAddress: null }, // native
      { timestamp: new Date("2025-01-02T00:00:00Z"), tokenAddress: usdcAddress }, // stable
      { timestamp: new Date("2025-01-03T00:00:00Z"), tokenAddress: pepeAddress }, // memecoin 1
      { timestamp: new Date("2025-01-04T00:00:00Z"), tokenAddress: pepeAddress }, // repeat
      { timestamp: new Date("2025-01-05T00:00:00Z"), tokenAddress: flokiAddress }, // memecoin 2
    ];

    const stats = computeWalletProfile({
      walletAddress: sampleWallet,
      chain: "base",
      transactions: txs,
      stableTokens: [usdcAddress],
      timezone: "UTC",
      now: new Date("2025-01-06T00:00:00Z"),
      dormancyDays: 30,
    });

    expect(stats.distinctTokenCount).toBe(2);
  });

  it("profile: walletAgeDaysAtFirstMemecoinTrade computed from firstTxAt", () => {
    const firstTx = new Date("2025-01-01T00:00:00Z");
    const firstMeme = new Date("2025-01-11T00:00:00Z"); // 10 days later

    const txs: ProfileTxInput[] = [
      { timestamp: firstTx, tokenAddress: null },
      { timestamp: firstMeme, tokenAddress: pepeAddress },
    ];

    const stats = computeWalletProfile({
      walletAddress: sampleWallet,
      chain: "base",
      transactions: txs,
      stableTokens: [usdcAddress],
      timezone: "UTC",
      now: new Date("2025-01-12T00:00:00Z"),
      dormancyDays: 30,
    });

    expect(stats.firstMemecoinTradeAt).toEqual(firstMeme);
    expect(stats.walletAgeDaysAtFirstMemecoinTrade).toBe(10);
  });

  it("profile: dormantSince is null for an active wallet", () => {
    const now = new Date("2026-01-15T00:00:00Z");
    const activeTx = new Date("2026-01-10T00:00:00Z"); // 5 days ago (< 30 days)

    const txs: ProfileTxInput[] = [{ timestamp: activeTx, tokenAddress: null }];

    const stats = computeWalletProfile({
      walletAddress: sampleWallet,
      chain: "base",
      transactions: txs,
      stableTokens: [usdcAddress],
      timezone: "UTC",
      now,
      dormancyDays: 30,
    });

    expect(stats.dormantSince).toBeNull();
  });

  it("profile: dormantSince is set when last activity exceeds dormancy threshold", () => {
    const now = new Date("2026-03-01T00:00:00Z");
    const oldTx = new Date("2026-01-01T00:00:00Z"); // 60 days ago (> 30 days)

    const txs: ProfileTxInput[] = [{ timestamp: oldTx, tokenAddress: null }];

    const stats = computeWalletProfile({
      walletAddress: sampleWallet,
      chain: "base",
      transactions: txs,
      stableTokens: [usdcAddress],
      timezone: "UTC",
      now,
      dormancyDays: 30,
    });

    expect(stats.dormantSince).toEqual(oldTx);
  });

  it("profile: recompute is idempotent", () => {
    const txs: ProfileTxInput[] = [
      { timestamp: new Date("2025-01-01T00:00:00Z"), tokenAddress: null },
      { timestamp: new Date("2025-01-02T00:00:00Z"), tokenAddress: pepeAddress },
    ];

    const p1 = computeWalletProfile({
      walletAddress: sampleWallet,
      chain: "base",
      transactions: txs,
      stableTokens: [usdcAddress],
      timezone: "UTC",
      now: new Date("2025-01-05T00:00:00Z"),
      dormancyDays: 30,
    });

    const p2 = computeWalletProfile({
      walletAddress: sampleWallet,
      chain: "base",
      transactions: txs,
      stableTokens: [usdcAddress],
      timezone: "UTC",
      now: new Date("2025-01-05T00:00:00Z"),
      dormancyDays: 30,
    });

    expect(p1.txCount).toBe(p2.txCount);
    expect(p1.distinctTokenCount).toBe(p2.distinctTokenCount);
    expect(p1.walletAgeDaysAtFirstMemecoinTrade).toBe(p2.walletAgeDaysAtFirstMemecoinTrade);
    expect(p1.heatmapJson).toEqual(p2.heatmapJson);
  });
});
