import { describe, expect, it, vi } from "vitest";

import { createEtherscanClient } from "@/lib/etherscan/client";
import { EtherscanClientError } from "@/lib/etherscan/errors";
import { createProviderCache } from "@/lib/cache/provider-cache";

function setup(fetcher: typeof fetch) {
  const values = new Map<string, string>();
  const cache = createProviderCache(
    { get: async (key) => values.get(key) ?? null, set: async (_key, value) => { values.set(_key, value); } },
    { findUnique: async () => null, upsert: async () => undefined },
  );
  let calls = 0;
  const client = createEtherscanClient({
    apiKey: "test",
    baseUrl: "https://example.test/v2/api",
    limiter: { acquire: async () => { calls += 1; }, budgetRemaining: async () => ({ dayCalls: calls, dayLimit: 100, remaining: 100 - calls }), snapshot: async () => ({ provider: "etherscan", tokensAvailable: 1, refillPerSecond: 4, callsToday: calls, dailyLimit: 100, remainingToday: 100 - calls, rateLimitHitsToday: 0, windowResetsAt: new Date() }) },
    cache,
    pageCap: 1000,
    retry: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2, jitter: "full", retryableErrors: ["RATE_LIMITED", "SERVER_ERROR", "NETWORK", "TIMEOUT"] },
    usage: { record: async () => undefined },
    logger: { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined },
    fetcher,
  });
  return { client, calls: () => calls };
}

const request = { chainId: 8453, module: "account" as const, action: "txlist", params: { address: "0x1" }, page: 1, offset: 1000, priority: "BACKGROUND" as const, cacheTtlMs: 0 };

describe("Etherscan client", () => {
  it("treats no transactions as an empty successful result", async () => {
    const { client } = setup(async () => new Response(JSON.stringify({ status: "0", message: "No transactions found", result: "No transactions found" }), { status: 200 }));
    await expect(client.fetchPage(request)).resolves.toEqual({ rows: [], fromCache: false });
  });

  it("fails invalid API keys without retrying", async () => {
    const { client, calls } = setup(async () => new Response(JSON.stringify({ status: "0", message: "Invalid API Key", result: [] }), { status: 200 }));
    await expect(client.fetchPage(request)).rejects.toMatchObject({ code: "INVALID_API_KEY" });
    expect(calls()).toBe(1);
  });

  it("retries a rate limit response with jitter and eventually succeeds", async () => {
    let attempt = 0;
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    const { client, calls } = setup(async () => {
      attempt += 1;
      return attempt === 1
        ? new Response(JSON.stringify({ status: "0", message: "Max rate limit reached", result: [] }), { status: 200 })
        : new Response(JSON.stringify({ status: "1", message: "OK", result: [{ hash: "0x1" }] }), { status: 200 });
    });
    await expect(client.fetchPage<{ hash: string }>(request)).resolves.toEqual({ rows: [{ hash: "0x1" }], fromCache: false });
    expect(calls()).toBe(2);
    random.mockRestore();
  });

  it("does not retry a bad request", async () => {
    const { client, calls } = setup(async () => new Response("bad", { status: 400 }));
    await expect(client.fetchPage(request)).rejects.toBeInstanceOf(EtherscanClientError);
    expect(calls()).toBe(1);
  });
});
