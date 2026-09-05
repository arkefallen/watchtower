import { describe, expect, it, vi } from "vitest";
import {
  takeBalanceSnapshots,
  type BalanceSnapshotInput,
  type BalancePricingContext,
} from "@/server/services/pricing/balances";
import type { Address, ChainAdapter, RawBalance } from "@/lib/chains/types";

describe("P1-T07: Balance Snapshots for Stables and Native", () => {
  const sampleWallet = "0x1111111111111111111111111111111111111111" as Address;
  const usdcAddress = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913".toLowerCase() as Address;
  const usdtAddress = "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2".toLowerCase() as Address;
  const memeAddress = "0x2222222222222222222222222222222222222222".toLowerCase() as Address;

  const mockPricing: BalancePricingContext = {
    getNativePriceUsd: async () => "3000.00",
  };

  const createMockAdapter = (balances: RawBalance[]): ChainAdapter => {
    return {
      chain: "base",
      chainId: 8453,
      nativeSymbol: "ETH",
      nativeDecimals: 18,
      getBalances: async (addr: Address, tokens: Address[]) => {
        // Return matching balances
        return balances.filter((b) => {
          if (b.tokenAddress === null) return true;
          return tokens.some((t: Address) => t.toLowerCase() === b.tokenAddress?.toLowerCase());
        });
      },
    } as unknown as ChainAdapter;
  };

  it("balances: native balance stored with null tokenAddress", async () => {
    const rawBalances: RawBalance[] = [
      {
        tokenAddress: null,
        balanceRaw: "1000000000000000000", // 1 ETH
        decimals: 18,
        symbol: "ETH",
      },
    ];
    const adapter = createMockAdapter(rawBalances);

    const result = await takeBalanceSnapshots({
      walletAddress: sampleWallet,
      chain: "base",
      adapter,
      stableTokens: [usdcAddress],
      pricing: mockPricing,
      timestamp: new Date("2026-01-01T12:34:56Z"),
    });

    expect(result.snapshots).toHaveLength(1);
    const native = result.snapshots.find((s) => s.tokenAddress === null);
    expect(native).toBeDefined();
    expect(native?.balanceRaw).toBe("1000000000000000000");
    expect(native?.isStable).toBe(false);
    expect(native?.balanceUsd).toBe("3000.00000000");
  });

  it("balances: only configured stables are snapshotted", async () => {
    const rawBalances: RawBalance[] = [
      { tokenAddress: null, balanceRaw: "0", decimals: 18, symbol: "ETH" },
      { tokenAddress: usdcAddress, balanceRaw: "100000000", decimals: 6, symbol: "USDC" }, // 100 USDC
      { tokenAddress: memeAddress, balanceRaw: "500000", decimals: 18, symbol: "MEME" }, // should be ignored
    ];
    const adapter = createMockAdapter(rawBalances);

    const result = await takeBalanceSnapshots({
      walletAddress: sampleWallet,
      chain: "base",
      adapter,
      stableTokens: [usdcAddress], // only usdc configured
      pricing: mockPricing,
      timestamp: new Date("2026-01-01T12:00:00Z"),
    });

    const tokens = result.snapshots.map((s) => s.tokenAddress);
    expect(tokens).toContain(null); // native
    expect(tokens).toContain(usdcAddress); // configured stable
    expect(tokens).not.toContain(memeAddress); // non-stable excluded
  });

  it("balances: stableBalanceUsd equals the sum of stable rows", async () => {
    const rawBalances: RawBalance[] = [
      { tokenAddress: null, balanceRaw: "1000000000000000000", decimals: 18, symbol: "ETH" },
      { tokenAddress: usdcAddress, balanceRaw: "100000000", decimals: 6, symbol: "USDC" }, // 100
      { tokenAddress: usdtAddress, balanceRaw: "250000000", decimals: 6, symbol: "USDT" }, // 250
    ];
    const adapter = createMockAdapter(rawBalances);

    const result = await takeBalanceSnapshots({
      walletAddress: sampleWallet,
      chain: "base",
      adapter,
      stableTokens: [usdcAddress, usdtAddress],
      pricing: mockPricing,
      timestamp: new Date("2026-01-01T12:00:00Z"),
    });

    // 100 + 250 = 350
    expect(parseFloat(result.stableBalanceUsd)).toBeCloseTo(350, 2);
  });

  it("balances: repeat run in the same hour is idempotent", async () => {
    const rawBalances: RawBalance[] = [
      { tokenAddress: usdcAddress, balanceRaw: "100000000", decimals: 6, symbol: "USDC" },
    ];
    const adapter = createMockAdapter(rawBalances);

    const t1 = new Date("2026-01-01T12:15:00Z");
    const t2 = new Date("2026-01-01T12:45:00Z");

    const r1 = await takeBalanceSnapshots({
      walletAddress: sampleWallet,
      chain: "base",
      adapter,
      stableTokens: [usdcAddress],
      pricing: mockPricing,
      timestamp: t1,
    });

    const r2 = await takeBalanceSnapshots({
      walletAddress: sampleWallet,
      chain: "base",
      adapter,
      stableTokens: [usdcAddress],
      pricing: mockPricing,
      timestamp: t2,
    });

    // Hour-truncated timestamp should be identical
    expect(r1.snapshots[0].timestamp.toISOString()).toBe(r2.snapshots[0].timestamp.toISOString());
    expect(r1.snapshots[0].timestamp.toISOString()).toBe("2026-01-01T12:00:00.000Z");
  });

  it("balances: unpriced stable stores null USD without failing the job", async () => {
    const rawBalances: RawBalance[] = [
      { tokenAddress: usdcAddress, balanceRaw: "100000000", decimals: null, symbol: "USDC" }, // decimals missing
    ];
    const adapter = createMockAdapter(rawBalances);

    const failingPricing: BalancePricingContext = {
      getNativePriceUsd: async () => null,
      getStableUsd: async () => null,
    };

    const result = await takeBalanceSnapshots({
      walletAddress: sampleWallet,
      chain: "base",
      adapter,
      stableTokens: [usdcAddress],
      pricing: failingPricing,
      timestamp: new Date("2026-01-01T12:00:00Z"),
    });

    expect(result.snapshots).toHaveLength(1);
    expect(result.snapshots[0].balanceUsd).toBeNull();
  });
});
