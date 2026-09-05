import { formatUnits } from "viem";
import type { ChainSlug, Address, RawAmount } from "@/lib/chains/types";
import type { SwapGroup } from "./swap";

export type UsdSourceName =
  | "SWAP_LEG_STABLE"
  | "SWAP_LEG_NATIVE"
  | "DEXSCREENER"
  | "COINGECKO"
  | "STABLE_PAR"
  | "NATIVE_PRICE"
  | "UNKNOWN";

export type PriceConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface UsdAttribution {
  amountUsd: string | null;
  priceUsdUsed: string | null;
  source: UsdSourceName;
  confidence: PriceConfidence | null;
  marketCap: string | null;
  notes?: string[];
}

export interface PricingLeg {
  tokenAddress: Address | null;
  chain: ChainSlug;
  amountRaw: RawAmount;
  decimals?: number | null;
  timestamp: Date;
  totalSupplyRaw?: RawAmount | null;
  swapGroup?: SwapGroup | null;
}

export interface PricingContext {
  stableTokens: string[]; // lowercase address list
  nativePriceStore: {
    nearest: (
      chain: ChainSlug,
      at: Date,
      maxSkewMs?: number
    ) => Promise<{ priceUsd: string; confidence: PriceConfidence } | null>;
  };
  dexscreenerClient?: {
    getTokens: (
      chain: ChainSlug,
      addresses: Address[]
    ) => Promise<
      Array<{
        address: Address;
        priceUsd: string | null;
        marketCap: string | null;
        liquidityUsd: string | null;
        fdv: string | null;
        pairCreatedAt: Date | null;
      }>
    >;
  };
  coingeckoClient?: {
    getHistoricalPrice: (
      chain: ChainSlug,
      address: Address,
      date: Date
    ) => Promise<{ priceUsd: string | null } | null>;
  };
}

export function parseRawToDecimal(rawAmount: string, decimals: number = 18): number {
  try {
    const formatted = formatUnits(BigInt(rawAmount), decimals);
    return Number(formatted);
  } catch {
    return 0;
  }
}

export async function attributeUsd(
  leg: PricingLeg,
  context: PricingContext
): Promise<UsdAttribution> {
  const tokenAddr = leg.tokenAddress?.toLowerCase();
  const isConfiguredStable = Boolean(tokenAddr && context.stableTokens.includes(tokenAddr));
  const isNative = leg.tokenAddress === null;
  const decimals = leg.decimals ?? (isNative ? 18 : 18);
  const tokenAmount = parseRawToDecimal(leg.amountRaw, decimals);

  // 1. Swap with stable leg (HIGH, SWAP_LEG_STABLE)
  if (leg.swapGroup) {
    const allLegs = [...leg.swapGroup.outLegs, ...leg.swapGroup.inLegs];
    const stableLeg = allLegs.find(
      (l) => l.isStable || (l.tokenAddress && context.stableTokens.includes(l.tokenAddress.toLowerCase()))
    );

    if (stableLeg) {
      const stableDecimals = stableLeg.decimals ?? 6;
      const stableUsdNum = parseRawToDecimal(stableLeg.amountRaw, stableDecimals);
      const stableUsdStr = String(stableUsdNum);

      let impliedPrice: number | null = null;
      if (tokenAmount > 0) {
        impliedPrice = stableUsdNum / tokenAmount;
      }

      let marketCap: string | null = null;
      if (impliedPrice !== null && leg.totalSupplyRaw) {
        const supplyNum = parseRawToDecimal(leg.totalSupplyRaw, decimals);
        marketCap = String(impliedPrice * supplyNum);
      }

      return {
        amountUsd: stableUsdStr,
        priceUsdUsed: impliedPrice !== null ? String(impliedPrice) : null,
        source: "SWAP_LEG_STABLE",
        confidence: "HIGH",
        marketCap,
      };
    }

    // 2. Swap with native leg (HIGH, SWAP_LEG_NATIVE)
    const nativeLeg = allLegs.find((l) => l.isNative || l.tokenAddress === null);
    if (nativeLeg) {
      const nativeSnapshot = await context.nativePriceStore.nearest(leg.chain, leg.timestamp);
      if (nativeSnapshot && nativeSnapshot.priceUsd) {
        const nativeAmountNum = parseRawToDecimal(nativeLeg.amountRaw, nativeLeg.decimals ?? 18);
        const nativePriceNum = Number(nativeSnapshot.priceUsd);
        const swapUsdNum = nativeAmountNum * nativePriceNum;
        const swapUsdStr = String(swapUsdNum);

        let impliedPrice: number | null = null;
        if (tokenAmount > 0) {
          impliedPrice = swapUsdNum / tokenAmount;
        }

        let marketCap: string | null = null;
        if (impliedPrice !== null && leg.totalSupplyRaw) {
          const supplyNum = parseRawToDecimal(leg.totalSupplyRaw, decimals);
          marketCap = String(impliedPrice * supplyNum);
        }

        return {
          amountUsd: swapUsdStr,
          priceUsdUsed: impliedPrice !== null ? String(impliedPrice) : null,
          source: "SWAP_LEG_NATIVE",
          confidence: "HIGH",
          marketCap,
        };
      }
    }
  }

  // 3. Configured stable transfer (HIGH, STABLE_PAR)
  if (isConfiguredStable) {
    const usdVal = parseRawToDecimal(leg.amountRaw, decimals);
    return {
      amountUsd: String(usdVal),
      priceUsdUsed: "1",
      source: "STABLE_PAR",
      confidence: "HIGH",
      marketCap: null,
    };
  }

  // Native transfer outside a swap
  if (isNative) {
    const nativeSnapshot = await context.nativePriceStore.nearest(leg.chain, leg.timestamp);
    if (nativeSnapshot && nativeSnapshot.priceUsd) {
      const priceNum = Number(nativeSnapshot.priceUsd);
      const totalUsd = tokenAmount * priceNum;
      return {
        amountUsd: String(totalUsd),
        priceUsdUsed: nativeSnapshot.priceUsd,
        source: "NATIVE_PRICE",
        confidence: nativeSnapshot.confidence,
        marketCap: null,
      };
    }
  }

  // 4. DexScreener at ingest (MEDIUM, DEXSCREENER)
  if (leg.tokenAddress && context.dexscreenerClient) {
    try {
      const results = await context.dexscreenerClient.getTokens(leg.chain, [leg.tokenAddress]);
      const match = results.find((r) => r.address.toLowerCase() === tokenAddr);
      if (match && match.priceUsd) {
        const priceNum = Number(match.priceUsd);
        const totalUsd = tokenAmount * priceNum;
        return {
          amountUsd: String(totalUsd),
          priceUsdUsed: match.priceUsd,
          source: "DEXSCREENER",
          confidence: "MEDIUM",
          marketCap: match.marketCap,
        };
      }
    } catch {
      // Fall through to CoinGecko
    }
  }

  // 5. CoinGecko historical (LOW, COINGECKO)
  if (leg.tokenAddress && context.coingeckoClient) {
    try {
      const cgResult = await context.coingeckoClient.getHistoricalPrice(
        leg.chain,
        leg.tokenAddress,
        leg.timestamp
      );
      if (cgResult && cgResult.priceUsd) {
        const priceNum = Number(cgResult.priceUsd);
        const totalUsd = tokenAmount * priceNum;
        return {
          amountUsd: String(totalUsd),
          priceUsdUsed: cgResult.priceUsd,
          source: "COINGECKO",
          confidence: "LOW",
          marketCap: null,
        };
      }
    } catch {
      // Fall through to UNKNOWN
    }
  }

  // 6. Unknown (null, UNKNOWN)
  return {
    amountUsd: null,
    priceUsdUsed: null,
    source: "UNKNOWN",
    confidence: null,
    marketCap: null,
    notes: ["No price available across 5 pricing tiers"],
  };
}
