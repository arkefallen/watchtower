import { z } from "zod";

import type { ProviderCache } from "@/lib/cache/provider-cache";
import type { CallPriority, RateLimiter } from "@/lib/ratelimit";
import type { DexScreenerClient, DexTokenPrice } from "./types";

const pairSchema = z.object({
  chainId: z.string().optional(),
  pairAddress: z.string().optional(),
  baseToken: z.object({ address: z.string() }).optional(),
  quoteToken: z.object({ address: z.string() }).optional(),
  priceUsd: z.string().nullable().optional(),
  marketCap: z.number().nullable().optional(),
  fdv: z.number().nullable().optional(),
  liquidity: z.object({ usd: z.number().nullable().optional() }).optional(),
  pairCreatedAt: z.number().nullable().optional(),
});
const responseSchema = z.array(pairSchema);

export interface DexScreenerDeps {
  chainId: string;
  limiter: Pick<RateLimiter, "acquire">;
  cache: ProviderCache;
  fetcher?: typeof fetch;
  priceCacheTtlSeconds?: number;
  priority?: CallPriority;
}

export function createDexScreenerClient(deps: DexScreenerDeps): DexScreenerClient {
  const fetcher = deps.fetcher ?? fetch;
  const ttlMs = (deps.priceCacheTtlSeconds ?? 60) * 1000;
  const priority = deps.priority ?? "BACKGROUND";
  return {
    async prices(addresses) {
      const normalized = [...new Set(addresses.map((address) => address.toLowerCase()))];
      const result = new Map<string, DexTokenPrice>();
      for (let offset = 0; offset < normalized.length; offset += 30) {
        const batch = normalized.slice(offset, offset + 30);
        const params = { addresses: batch.join(",") };
        const cacheKey = deps.cache.keyFor("dexscreener", `tokens:${deps.chainId}`, params);
        const cached = await deps.cache.get<DexTokenPrice[]>(cacheKey);
        if (cached) { cached.forEach((item) => result.set(item.address, item)); continue; }
        let parsed: z.infer<typeof responseSchema> | null = null;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          await deps.limiter.acquire(1, priority);
          try {
            const response = await fetcher(`https://api.dexscreener.com/tokens/v1/${deps.chainId}/${batch.join(",")}`);
            if (response.status >= 500 && attempt < 3) continue;
            if (!response.ok) break;
            parsed = responseSchema.parse(await response.json());
            break;
          } catch {
            if (attempt === 3) break;
          }
        }
        if (!parsed) {
          for (const address of batch) result.set(address, { address, priceUsd: null, marketCap: null, liquidityUsd: null, fdv: null, pairCreatedAt: null, pairAddress: null });
          continue;
        }
        try {
          const rows = new Map<string, DexTokenPrice>();
          for (const address of batch) {
            const pairs = parsed.filter((pair) => pair.baseToken?.address.toLowerCase() === address || pair.quoteToken?.address.toLowerCase() === address);
            const primary = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
            const item: DexTokenPrice = { address, priceUsd: primary?.priceUsd ?? null, marketCap: primary?.marketCap ?? null, liquidityUsd: primary?.liquidity?.usd ?? null, fdv: primary?.fdv ?? null, pairCreatedAt: primary?.pairCreatedAt ? new Date(primary.pairCreatedAt) : null, pairAddress: primary?.pairAddress ?? null };
            rows.set(address, item);
            result.set(address, item);
          }
          await deps.cache.set(cacheKey, [...rows.values()], ttlMs);
        } catch { for (const address of batch) result.set(address, { address, priceUsd: null, marketCap: null, liquidityUsd: null, fdv: null, pairCreatedAt: null, pairAddress: null }); }
      }
      return result;
    },
  };
}
