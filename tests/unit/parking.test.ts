import { describe, expect, it } from "vitest";
import {
  computeParkingFromTransfers,
  type ParkingTransferInput,
  type ParkingBalanceInput,
} from "@/server/services/funding/parking";
import type { Address } from "@/lib/chains/types";

describe("P1-T08: Stablecoin Parking Detection and Timeline", () => {
  const wallet = "0x1111111111111111111111111111111111111111" as Address;
  const usdcBase = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913".toLowerCase() as Address;
  const usdtBsc = "0x55d398326f99059ff775485246999027b3197955".toLowerCase() as Address;
  const memeToken = "0x2222222222222222222222222222222222222222".toLowerCase() as Address;
  const binanceCex = "0x28c6c06298d514db089934071355e5743bf21d60".toLowerCase() as Address;

  const stableTokensMap = {
    base: [usdcBase],
    bsc: [usdtBsc],
    robinhood: [],
  };

  const entityLabels: Record<string, string> = {
    [binanceCex]: "Binance 14",
  };

  it("parking: inflow and outflow events are both captured", () => {
    const transfers: ParkingTransferInput[] = [
      {
        chain: "base",
        hash: "0x1",
        tokenAddress: usdcBase,
        tokenSymbol: "USDC",
        from: binanceCex,
        to: wallet,
        amountRaw: "1000000000",
        amountUsd: "1000.00",
        timestamp: new Date("2026-01-01T10:00:00Z"),
      },
      {
        chain: "base",
        hash: "0x2",
        tokenAddress: usdcBase,
        tokenSymbol: "USDC",
        from: wallet,
        to: "0x9999999999999999999999999999999999999999" as Address,
        amountRaw: "200000000",
        amountUsd: "200.00",
        timestamp: new Date("2026-01-02T10:00:00Z"),
      },
    ];

    const balances: ParkingBalanceInput[] = [
      {
        chain: "base",
        tokenAddress: usdcBase,
        symbol: "USDC",
        balanceRaw: "800000000",
        balanceUsd: "800.00",
      },
    ];

    const summary = computeParkingFromTransfers({
      walletAddress: wallet,
      transfers,
      balances,
      stableTokensMap,
      entityLabels,
    });

    expect(summary.timeline).toHaveLength(2);
    expect(summary.timeline[0].direction).toBe("IN");
    expect(summary.timeline[0].amountUsd).toBe("1000.00");
    expect(summary.timeline[1].direction).toBe("OUT");
    expect(summary.timeline[1].amountUsd).toBe("200.00");
  });

  it("parking: per-chain balances are separated", () => {
    const balances: ParkingBalanceInput[] = [
      {
        chain: "base",
        tokenAddress: usdcBase,
        symbol: "USDC",
        balanceRaw: "500000000",
        balanceUsd: "500.00",
      },
      {
        chain: "bsc",
        tokenAddress: usdtBsc,
        symbol: "USDT",
        balanceRaw: "1200000000000000000000",
        balanceUsd: "1200.00",
      },
    ];

    const summary = computeParkingFromTransfers({
      walletAddress: wallet,
      transfers: [],
      balances,
      stableTokensMap,
      entityLabels: {},
    });

    expect(summary.perChain).toHaveLength(2);
    const baseChain = summary.perChain.find((c) => c.chain === "base");
    const bscChain = summary.perChain.find((c) => c.chain === "bsc");

    expect(baseChain?.parkedUsd).toBe("500.00000000");
    expect(bscChain?.parkedUsd).toBe("1200.00000000");
    expect(summary.totalParkedUsd).toBe("1700.00000000");
  });

  it("parking: timeline is ordered by timestamp", () => {
    const transfers: ParkingTransferInput[] = [
      {
        chain: "base",
        hash: "0x2",
        tokenAddress: usdcBase,
        tokenSymbol: "USDC",
        from: wallet,
        to: "0x9999999999999999999999999999999999999999" as Address,
        amountRaw: "100000000",
        amountUsd: "100.00",
        timestamp: new Date("2026-01-05T00:00:00Z"),
      },
      {
        chain: "base",
        hash: "0x1",
        tokenAddress: usdcBase,
        tokenSymbol: "USDC",
        from: binanceCex,
        to: wallet,
        amountRaw: "500000000",
        amountUsd: "500.00",
        timestamp: new Date("2026-01-01T00:00:00Z"),
      },
    ];

    const summary = computeParkingFromTransfers({
      walletAddress: wallet,
      transfers,
      balances: [],
      stableTokensMap,
      entityLabels: {},
    });

    expect(summary.timeline).toHaveLength(2);
    expect(summary.timeline[0].txHash).toBe("0x1");
    expect(summary.timeline[1].txHash).toBe("0x2");
  });

  it("parking: counterparty CEX name is attached when labeled", () => {
    const transfers: ParkingTransferInput[] = [
      {
        chain: "base",
        hash: "0x1",
        tokenAddress: usdcBase,
        tokenSymbol: "USDC",
        from: binanceCex,
        to: wallet,
        amountRaw: "1000000000",
        amountUsd: "1000.00",
        timestamp: new Date("2026-01-01T00:00:00Z"),
      },
    ];

    const summary = computeParkingFromTransfers({
      walletAddress: wallet,
      transfers,
      balances: [],
      stableTokensMap,
      entityLabels,
    });

    expect(summary.timeline[0].counterpartyAddress).toBe(binanceCex);
    expect(summary.timeline[0].counterpartyEntityName).toBe("Binance 14");
  });

  it("parking: peak parked USD and timestamp are recorded", () => {
    const transfers: ParkingTransferInput[] = [
      {
        chain: "base",
        hash: "0x1",
        tokenAddress: usdcBase,
        tokenSymbol: "USDC",
        from: binanceCex,
        to: wallet,
        amountRaw: "1000000000",
        amountUsd: "1000.00",
        timestamp: new Date("2026-01-01T00:00:00Z"),
      },
      {
        chain: "base",
        hash: "0x2",
        tokenAddress: usdcBase,
        tokenSymbol: "USDC",
        from: binanceCex,
        to: wallet,
        amountRaw: "2000000000",
        amountUsd: "2000.00",
        timestamp: new Date("2026-01-02T00:00:00Z"),
      },
      {
        chain: "base",
        hash: "0x3",
        tokenAddress: usdcBase,
        tokenSymbol: "USDC",
        from: wallet,
        to: "0x9999999999999999999999999999999999999999" as Address,
        amountRaw: "1500000000",
        amountUsd: "1500.00",
        timestamp: new Date("2026-01-03T00:00:00Z"),
      },
    ];

    const summary = computeParkingFromTransfers({
      walletAddress: wallet,
      transfers,
      balances: [],
      stableTokensMap,
      entityLabels: {},
    });

    // Inflows: +1000 (running 1000), +2000 (running 3000), Outflow: -1500 (running 1500)
    // Peak parked USD = 3000 at 2026-01-02
    expect(parseFloat(summary.peakUsd!)).toBeCloseTo(3000, 2);
    expect(summary.peakAt).toEqual(new Date("2026-01-02T00:00:00Z"));
  });

  it("parking: non-configured token is not treated as stable", () => {
    const transfers: ParkingTransferInput[] = [
      {
        chain: "base",
        hash: "0x1",
        tokenAddress: memeToken, // not stable
        tokenSymbol: "MEME",
        from: binanceCex,
        to: wallet,
        amountRaw: "500000000",
        amountUsd: "500.00",
        timestamp: new Date("2026-01-01T00:00:00Z"),
      },
    ];

    const balances: ParkingBalanceInput[] = [
      {
        chain: "base",
        tokenAddress: memeToken,
        symbol: "MEME",
        balanceRaw: "500000000",
        balanceUsd: "500.00",
      },
    ];

    const summary = computeParkingFromTransfers({
      walletAddress: wallet,
      transfers,
      balances,
      stableTokensMap,
      entityLabels: {},
    });

    expect(summary.timeline).toHaveLength(0);
    expect(summary.totalParkedUsd).toBe("0.00000000");
  });
});
