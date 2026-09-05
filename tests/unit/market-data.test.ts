import { describe, expect, it } from "vitest";

import { createCoinGeckoClient } from "@/lib/coingecko/client";
import { createDexScreenerClient } from "@/lib/dexscreener/client";

function cache() {
  const values = new Map<string, string>();
  return {
    get: async <T>(key: string) => values.has(key) ? JSON.parse(values.get(key) as string) as T : null,
    set: async <T>(key: string, value: T) => { values.set(key, JSON.stringify(value)); },
    keyFor: (_provider: string, endpoint: string, params: Record<string, unknown>) => `${endpoint}:${JSON.stringify(params)}`,
  };
}

describe("market data clients", () => {
  it("batches 45 DexScreener addresses into two calls and caches", async () => {
    let calls = 0;
    const addresses = Array.from({ length: 45 }, (_, i) => `0x${i.toString(16).padStart(40, "0")}`);
    const client = createDexScreenerClient({
      chainId: "base",
      limiter: { acquire: async () => undefined },
      cache: cache(),
      fetcher: async (input) => { calls += 1; expect(String(input)).toContain("/tokens/v1/base/"); return new Response("[]"); },
    });
    await client.prices(addresses);
    await client.prices(addresses);
    expect(calls).toBe(2);
  });

  it("degrades an unknown DexScreener token to null fields", async () => {
    const client = createDexScreenerClient({ chainId: "base", limiter: { acquire: async () => undefined }, cache: cache(), fetcher: async () => new Response("[]") });
    expect((await client.prices(["0x0000000000000000000000000000000000000001"])).get("0x0000000000000000000000000000000000000001")?.priceUsd).toBeNull();
  });

  it("retries DexScreener 5xx and then degrades to null fields", async () => {
    let calls = 0;
    const client = createDexScreenerClient({
      chainId: "base",
      limiter: { acquire: async () => undefined },
      cache: cache(),
      fetcher: async (input) => { calls += 1; expect(String(input)).toContain("/tokens/v1/base/"); return new Response("down", { status: 503 }); },
    });

    const result = await client.prices(["0x0000000000000000000000000000000000000001"]);

    expect(calls).toBe(3);
    expect(result.get("0x0000000000000000000000000000000000000001")?.priceUsd).toBeNull();
  });

  it("disables CoinGecko without an API key and makes no HTTP call", async () => {
    let calls = 0;
    const client = createCoinGeckoClient({ fetcher: async () => { calls += 1; return new Response("{}"); } });
    expect(client.enabled).toBe(false);
    await expect(client.historicalPrice("0x1", new Date())).resolves.toBeNull();
    expect(calls).toBe(0);
  });

  it("degrades CoinGecko failures to null", async () => {
    const client = createCoinGeckoClient({ apiKey: "test", limiter: { acquire: async () => undefined }, fetcher: async () => new Response("error", { status: 500 }) });
    await expect(client.historicalPrice("0x0000000000000000000000000000000000000001", new Date())).resolves.toBeNull();
  });
});
