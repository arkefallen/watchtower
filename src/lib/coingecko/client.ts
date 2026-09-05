import { z } from "zod";
import type { RateLimiter } from "@/lib/ratelimit";

export interface CoinGeckoClient {
  readonly enabled: boolean;
  historicalPrice(contractAddress: string, date: Date): Promise<number | null>;
}

const responseSchema = z.object({ market_data: z.object({ current_price: z.record(z.string(), z.number()) }).optional() });

export interface CoinGeckoDeps { apiKey?: string; limiter?: Pick<RateLimiter, "acquire">; fetcher?: typeof fetch; }

export function createCoinGeckoClient(deps: CoinGeckoDeps): CoinGeckoClient {
  const enabled = Boolean(deps.apiKey);
  const fetcher = deps.fetcher ?? fetch;
  return {
    enabled,
    async historicalPrice(contractAddress, date) {
      if (!enabled) return null;
      try {
        const formatted = `${date.getUTCDate().toString().padStart(2, "0")}-${(date.getUTCMonth() + 1).toString().padStart(2, "0")}-${date.getUTCFullYear()}`;
        if (deps.limiter) await deps.limiter.acquire(1, "BACKGROUND");
        const response = await fetcher(`https://api.coingecko.com/api/v3/coins/ethereum/contract/${contractAddress}/history?date=${formatted}`, { headers: { "x-cg-demo-api-key": deps.apiKey as string } });
        if (!response.ok) return null;
        const parsed = responseSchema.parse(await response.json());
        return parsed.market_data?.current_price.usd ?? null;
      } catch { return null; }
    },
  };
}
