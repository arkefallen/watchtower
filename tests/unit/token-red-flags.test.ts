import { describe, it, expect } from "vitest";
import {
  evaluateTokenRedFlags,
  type PromoterWarning,
} from "@/server/services/token/red-flags";

describe("P6-T02: Token holder concentration and red-flag checks", () => {
  const tokenAddress = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
  const deployerAddress = "0xde91000000000000000000000000000000000001";
  const trackedWalletA = "0x1111111111111111111111111111111111111111";
  const trackedWalletB = "0x2222222222222222222222222222222222222222";
  const regularUserWallet = "0x9999999999999999999999999999999999999999";

  it("red-flags: deployer-to-tracked-wallet transfer raises the promoter warning", () => {
    const transactions = [
      {
        hash: "0xpromo001",
        fromAddress: deployerAddress,
        toAddress: trackedWalletA,
        tokenAddress,
        valueRaw: "1000000000000",
        timestamp: new Date("2026-03-01T12:00:00.000Z"),
      },
    ];

    const result = evaluateTokenRedFlags({
      tokenAddress,
      chain: "base",
      deployerAddress,
      deployedAt: new Date("2026-01-01T00:00:00.000Z"),
      transactions,
      trackedWalletAddresses: [trackedWalletA, trackedWalletB],
    });

    expect(result.hasPromoterWarning).toBe(true);
    expect(result.promoterWarnings.length).toBe(1);
    expect(result.promoterWarnings[0].walletAddress).toBe(trackedWalletA.toLowerCase());
  });

  it("red-flags: transfer from a non-deployer does not", () => {
    const transactions = [
      {
        hash: "0xnormal001",
        fromAddress: regularUserWallet, // Not the deployer
        toAddress: trackedWalletA,
        tokenAddress,
        valueRaw: "5000000000",
        timestamp: new Date("2026-03-01T12:00:00.000Z"),
      },
    ];

    const result = evaluateTokenRedFlags({
      tokenAddress,
      chain: "base",
      deployerAddress,
      deployedAt: new Date("2026-01-01T00:00:00.000Z"),
      transactions,
      trackedWalletAddresses: [trackedWalletA, trackedWalletB],
    });

    expect(result.hasPromoterWarning).toBe(false);
    expect(result.promoterWarnings.length).toBe(0);
  });

  it("red-flags: warning names the wallet and the tx hash", () => {
    const expectedHash = "0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678";
    const transactions = [
      {
        hash: expectedHash,
        fromAddress: deployerAddress,
        toAddress: trackedWalletB,
        tokenAddress,
        valueRaw: "2500000000000",
        timestamp: new Date("2026-03-02T15:30:00.000Z"),
      },
    ];

    const result = evaluateTokenRedFlags({
      tokenAddress,
      chain: "base",
      deployerAddress,
      deployedAt: new Date("2026-01-01T00:00:00.000Z"),
      transactions,
      trackedWalletAddresses: [trackedWalletA, trackedWalletB],
    });

    expect(result.hasPromoterWarning).toBe(true);
    const warning = result.promoterWarnings[0];
    expect(warning.walletAddress).toBe(trackedWalletB.toLowerCase());
    expect(warning.txHash).toBe(expectedHash);
  });

  it("red-flags: top-10 share stored when the explorer provides holders", () => {
    const holderSummary = {
      top10SharePct: 42.85,
      holderCount: 1540,
      source: "ETHERSCAN",
    };

    const result = evaluateTokenRedFlags({
      tokenAddress,
      chain: "base",
      deployerAddress,
      deployedAt: new Date("2026-01-01T00:00:00.000Z"),
      transactions: [],
      trackedWalletAddresses: [trackedWalletA],
      holderSummary,
    });

    expect(result.holderDataUnavailable).toBe(false);
    expect(result.top10SharePct).toBe(42.85);
    expect(result.holderCount).toBe(1540);
  });

  it("red-flags: unavailable holder data reported explicitly, not as 0%", () => {
    // When explorer cannot provide holder distribution
    const unavailableSummary = {
      top10SharePct: null,
      holderCount: null,
      source: "UNAVAILABLE",
    };

    const result = evaluateTokenRedFlags({
      tokenAddress,
      chain: "base",
      deployerAddress,
      deployedAt: new Date("2026-01-01T00:00:00.000Z"),
      transactions: [],
      trackedWalletAddresses: [trackedWalletA],
      holderSummary: unavailableSummary,
    });

    expect(result.holderDataUnavailable).toBe(true);
    expect(result.top10SharePct).toBeNull();
    expect(result.top10SharePct).not.toBe(0);
  });

  it("red-flags: token age derived from deployedAt", () => {
    const deployedAt = new Date("2026-01-01T00:00:00.000Z");
    const now = new Date("2026-03-02T00:00:00.000Z"); // 60 days later

    const result = evaluateTokenRedFlags({
      tokenAddress,
      chain: "base",
      deployerAddress,
      deployedAt,
      transactions: [],
      trackedWalletAddresses: [trackedWalletA],
      now,
    });

    expect(result.tokenAgeDays).toBe(60);
    expect(result.deployedAt).toBe(deployedAt.toISOString());
  });

  it("red-flags: multiple promoter wallets are all listed", () => {
    const transactions = [
      {
        hash: "0xtx111",
        fromAddress: deployerAddress,
        toAddress: trackedWalletA,
        tokenAddress,
        valueRaw: "100000",
        timestamp: new Date("2026-02-01T10:00:00.000Z"),
      },
      {
        hash: "0xtx222",
        fromAddress: deployerAddress,
        toAddress: trackedWalletB,
        tokenAddress,
        valueRaw: "200000",
        timestamp: new Date("2026-02-02T11:00:00.000Z"),
      },
      {
        hash: "0xtx333",
        fromAddress: regularUserWallet, // Not deployer
        toAddress: trackedWalletA,
        tokenAddress,
        valueRaw: "50000",
        timestamp: new Date("2026-02-03T12:00:00.000Z"),
      },
    ];

    const result = evaluateTokenRedFlags({
      tokenAddress,
      chain: "base",
      deployerAddress,
      deployedAt: new Date("2026-01-01T00:00:00.000Z"),
      transactions,
      trackedWalletAddresses: [trackedWalletA, trackedWalletB],
    });

    expect(result.hasPromoterWarning).toBe(true);
    expect(result.promoterWarnings.length).toBe(2);

    const promoterWallets = result.promoterWarnings.map((w: PromoterWarning) => w.walletAddress);
    expect(promoterWallets).toContain(trackedWalletA.toLowerCase());
    expect(promoterWallets).toContain(trackedWalletB.toLowerCase());
  });
});
