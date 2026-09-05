import { describe, expect, it, vi } from "vitest";
import { classifySwap, type SwapGroupInput } from "@/server/services/pricing/swap";
import {
  attributeUsd,
  type PricingContext,
  type PricingLeg,
} from "@/server/services/pricing/attribute";
import { persistPriceSnapshots } from "@/server/services/pricing/snapshot";
import type { Address } from "@/lib/chains/types";

describe("P1-T05: Pricing and USD Attribution Engine", () => {
  const defaultStables = ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913".toLowerCase()]; // USDC on Base
  const pepeAddress = "0x2222222222222222222222222222222222222222" as Address;
  const usdcAddress = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" as Address;
  const sampleWallet = "0x1111111111111111111111111111111111111111" as Address;
  const txHash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

  it("pricing: swapGroupKey groups all rows of one hash for one wallet", () => {
    const rows: SwapGroupInput[] = [
      {
        hash: txHash,
        chain: "base",
        walletAddress: sampleWallet,
        fromAddress: sampleWallet,
        toAddress: "0xrouter" as Address,
        tokenAddress: usdcAddress,
        amountRaw: "100000000", // 100 USDC (6 decimals)
        tokenDecimals: 6,
        isStable: true,
        isNative: false,
      },
      {
        hash: txHash,
        chain: "base",
        walletAddress: sampleWallet,
        fromAddress: "0xpool" as Address,
        toAddress: sampleWallet,
        tokenAddress: pepeAddress,
        amountRaw: "1000000000000000000000", // 1,000 PEPE (18 decimals)
        tokenDecimals: 18,
        isStable: false,
        isNative: false,
      },
    ];

    const swap = classifySwap(rows);
    expect(swap).not.toBeNull();
    expect(swap?.swapGroupKey).toBe(`base:${txHash}:${sampleWallet}`);
    expect(swap?.outLegs).toHaveLength(1);
    expect(swap?.inLegs).toHaveLength(1);
  });

  it("pricing: stable leg yields exact USD and HIGH confidence", async () => {
    const leg: PricingLeg = {
      tokenAddress: pepeAddress,
      chain: "base",
      amountRaw: "1000000000000000000000", // 1,000 PEPE
      decimals: 18,
      timestamp: new Date(),
      swapGroup: {
        swapGroupKey: `base:${txHash}:${sampleWallet}`,
        outLegs: [
          {
            tokenAddress: usdcAddress,
            amountRaw: "50000000", // 50 USDC (6 decimals)
            decimals: 6,
            isStable: true,
            isNative: false,
          },
        ],
        inLegs: [
          {
            tokenAddress: pepeAddress,
            amountRaw: "1000000000000000000000",
            decimals: 18,
            isStable: false,
            isNative: false,
          },
        ],
      },
    };

    const context: PricingContext = {
      stableTokens: defaultStables,
      nativePriceStore: { nearest: vi.fn() },
      dexscreenerClient: { getTokens: vi.fn() },
    };

    const attribution = await attributeUsd(leg, context);
    expect(attribution.amountUsd).toBe("50");
    expect(attribution.source).toBe("SWAP_LEG_STABLE");
    expect(attribution.confidence).toBe("HIGH");
  });

  it("pricing: implied unit price = stableUsd / tokenAmount", async () => {
    const leg: PricingLeg = {
      tokenAddress: pepeAddress,
      chain: "base",
      amountRaw: "1000000000000000000000", // 1,000 PEPE
      decimals: 18,
      timestamp: new Date(),
      swapGroup: {
        swapGroupKey: `base:${txHash}:${sampleWallet}`,
        outLegs: [
          {
            tokenAddress: usdcAddress,
            amountRaw: "50000000", // 50 USDC
            decimals: 6,
            isStable: true,
            isNative: false,
          },
        ],
        inLegs: [
          {
            tokenAddress: pepeAddress,
            amountRaw: "1000000000000000000000", // 1000 PEPE
            decimals: 18,
            isStable: false,
            isNative: false,
          },
        ],
      },
    };

    const context: PricingContext = {
      stableTokens: defaultStables,
      nativePriceStore: { nearest: vi.fn() },
      dexscreenerClient: { getTokens: vi.fn() },
    };

    const attribution = await attributeUsd(leg, context);
    // 50 USD / 1000 PEPE = 0.05 USD per PEPE
    expect(Number(attribution.priceUsdUsed)).toBeCloseTo(0.05, 4);
  });

  it("pricing: native leg uses the nearest native snapshot", async () => {
    const leg: PricingLeg = {
      tokenAddress: pepeAddress,
      chain: "base",
      amountRaw: "1000000000000000000000",
      decimals: 18,
      timestamp: new Date("2026-01-01T12:00:00Z"),
      swapGroup: {
        swapGroupKey: `base:${txHash}:${sampleWallet}`,
        outLegs: [
          {
            tokenAddress: null, // native ETH
            amountRaw: "1000000000000000000", // 1 ETH (18 decimals)
            decimals: 18,
            isStable: false,
            isNative: true,
          },
        ],
        inLegs: [
          {
            tokenAddress: pepeAddress,
            amountRaw: "1000000000000000000000",
            decimals: 18,
            isStable: false,
            isNative: false,
          },
        ],
      },
    };

    const context: PricingContext = {
      stableTokens: defaultStables,
      nativePriceStore: {
        nearest: vi.fn().mockResolvedValue({
          priceUsd: "3000",
          confidence: "HIGH",
        }),
      },
      dexscreenerClient: { getTokens: vi.fn() },
    };

    const attribution = await attributeUsd(leg, context);
    expect(attribution.amountUsd).toBe("3000");
    expect(attribution.source).toBe("SWAP_LEG_NATIVE");
    expect(attribution.confidence).toBe("HIGH");
    expect(Number(attribution.priceUsdUsed)).toBeCloseTo(3, 4); // 3000 USD / 1000 tokens = 3 USD/token
  });

  it("pricing: stablecoin transfer is valued at par", async () => {
    const leg: PricingLeg = {
      tokenAddress: usdcAddress,
      chain: "base",
      amountRaw: "250000000", // 250 USDC
      decimals: 6,
      timestamp: new Date(),
    };

    const context: PricingContext = {
      stableTokens: defaultStables,
      nativePriceStore: { nearest: vi.fn() },
      dexscreenerClient: { getTokens: vi.fn() },
    };

    const attribution = await attributeUsd(leg, context);
    expect(attribution.amountUsd).toBe("250");
    expect(attribution.source).toBe("STABLE_PAR");
    expect(attribution.confidence).toBe("HIGH");
    expect(attribution.priceUsdUsed).toBe("1");
  });

  it("pricing: falls back to DexScreener for a bare transfer", async () => {
    const leg: PricingLeg = {
      tokenAddress: pepeAddress,
      chain: "base",
      amountRaw: "1000000000000000000000", // 1,000 PEPE
      decimals: 18,
      timestamp: new Date(),
    };

    const context: PricingContext = {
      stableTokens: defaultStables,
      nativePriceStore: { nearest: vi.fn() },
      dexscreenerClient: {
        getTokens: vi.fn().mockResolvedValue([
          {
            address: pepeAddress,
            priceUsd: "0.002",
            marketCap: "2000000",
            liquidityUsd: "500000",
            fdv: "2000000",
            pairCreatedAt: new Date(),
          },
        ]),
      },
    };

    const attribution = await attributeUsd(leg, context);
    expect(attribution.source).toBe("DEXSCREENER");
    expect(attribution.confidence).toBe("MEDIUM");
    expect(Number(attribution.amountUsd)).toBeCloseTo(2, 4); // 1000 * 0.002 = 2 USD
    expect(attribution.marketCap).toBe("2000000");
  });

  it("pricing: CoinGecko fallback marked LOW confidence", async () => {
    const leg: PricingLeg = {
      tokenAddress: pepeAddress,
      chain: "base",
      amountRaw: "1000000000000000000000",
      decimals: 18,
      timestamp: new Date("2025-01-01T00:00:00Z"),
    };

    const context: PricingContext = {
      stableTokens: defaultStables,
      nativePriceStore: { nearest: vi.fn() },
      dexscreenerClient: {
        getTokens: vi.fn().mockResolvedValue([]),
      },
      coingeckoClient: {
        getHistoricalPrice: vi.fn().mockResolvedValue({
          priceUsd: "0.001",
        }),
      },
    };

    const attribution = await attributeUsd(leg, context);
    expect(attribution.source).toBe("COINGECKO");
    expect(attribution.confidence).toBe("LOW");
    expect(Number(attribution.amountUsd)).toBeCloseTo(1, 4);
  });

  it("pricing: unpriceable event stores null, not zero", async () => {
    const leg: PricingLeg = {
      tokenAddress: pepeAddress,
      chain: "base",
      amountRaw: "1000000000000000000000",
      decimals: 18,
      timestamp: new Date(),
    };

    const context: PricingContext = {
      stableTokens: defaultStables,
      nativePriceStore: { nearest: vi.fn() },
      dexscreenerClient: {
        getTokens: vi.fn().mockResolvedValue([]),
      },
      coingeckoClient: {
        getHistoricalPrice: vi.fn().mockResolvedValue(null),
      },
    };

    const attribution = await attributeUsd(leg, context);
    expect(attribution.amountUsd).toBeNull();
    expect(attribution.priceUsdUsed).toBeNull();
    expect(attribution.source).toBe("UNKNOWN");
    expect(attribution.confidence).toBeNull();
  });

  it("pricing: marketCap uses implied price × known supply", async () => {
    const leg: PricingLeg = {
      tokenAddress: pepeAddress,
      chain: "base",
      amountRaw: "1000000000000000000000", // 1000 PEPE
      decimals: 18,
      timestamp: new Date(),
      totalSupplyRaw: "1000000000000000000000000", // 1,000,000 PEPE
      swapGroup: {
        swapGroupKey: `base:${txHash}:${sampleWallet}`,
        outLegs: [
          {
            tokenAddress: usdcAddress,
            amountRaw: "100000000", // 100 USDC
            decimals: 6,
            isStable: true,
            isNative: false,
          },
        ],
        inLegs: [
          {
            tokenAddress: pepeAddress,
            amountRaw: "1000000000000000000000",
            decimals: 18,
            isStable: false,
            isNative: false,
          },
        ],
      },
    };

    const context: PricingContext = {
      stableTokens: defaultStables,
      nativePriceStore: { nearest: vi.fn() },
      dexscreenerClient: { getTokens: vi.fn() },
    };

    const attribution = await attributeUsd(leg, context);
    // Price = 100 / 1000 = 0.1 USD. Total supply = 1,000,000. Market cap = 100,000 USD
    expect(attribution.marketCap).toBe("100000");
  });

  it("pricing: re-running enrichment does not duplicate PriceSnapshot rows", async () => {
    const snapshotStore = new Map<string, any>();
    const mockPrisma: any = {
      priceSnapshot: {
        upsert: vi.fn().mockImplementation(({ where, create }) => {
          const key = `${where.price_snapshot_natural_key.chain}:${where.price_snapshot_natural_key.tokenAddress}:${where.price_snapshot_natural_key.timestamp}:${where.price_snapshot_natural_key.source}`;
          if (!snapshotStore.has(key)) {
            snapshotStore.set(key, create);
          }
          return Promise.resolve(snapshotStore.get(key));
        }),
      },
    };

    const snapshots = [
      {
        tokenAddress: pepeAddress,
        chain: "base" as const,
        timestamp: new Date("2026-01-01T00:00:00Z"),
        priceUsd: "0.05",
        marketCap: "50000",
        source: "SWAP_LEG_STABLE" as const,
        confidence: "HIGH" as const,
      },
    ];

    const res1 = await persistPriceSnapshots(mockPrisma, snapshots);
    const res2 = await persistPriceSnapshots(mockPrisma, snapshots);

    expect(res1).toBe(1);
    expect(res2).toBe(1);
    expect(snapshotStore.size).toBe(1);
  });
});
