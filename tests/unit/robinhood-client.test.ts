import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createRobinhoodProviderClient, RobinhoodProviderError } from "@/lib/robinhood/client";

const address = "0x0000000000000000000000000000000000000001" as `${string}` & { readonly __brand: "Address" };
const limiter = { acquire: async () => undefined, budgetRemaining: async () => ({ dayCalls: 0, dayLimit: 100, remaining: 100 }), snapshot: async () => ({ provider: "test", tokensAvailable: 1, refillPerSecond: 1, callsToday: 0, dailyLimit: 100, remainingToday: 100, rateLimitHitsToday: 0, windowResetsAt: new Date() }) };

describe("Robinhood provider client", () => {
  it("replays the sanitized recorded transfer fixture offline", async () => {
    const fixture: unknown = JSON.parse(await readFile(new URL("../fixtures/robinhood/transfers-page.json", import.meta.url), "utf8"));
    const client = createRobinhoodProviderClient({ apiKey: "alchemy", limiter, fetcher: async () => new Response(JSON.stringify(fixture), { status: 200 }) });
    const result = await client.transfers(address, "external", 0n, 20n);
    expect(result.rows).toHaveLength(1);
    expect(result.pageKey).toBe("fixture-next-page");
  });

  it("normalizes Blockscout internal pages and preserves the next cursor", async () => {
    let calls = 0;
    const client = createRobinhoodProviderClient({ apiKey: "alchemy", blockscoutApiKey: "proapi_test", limiter, fetcher: async () => { calls += 1; return new Response(JSON.stringify({ items: [{ block_number: 10, transaction_hash: "0xhash", index: 2, value: "0x1", timestamp: "2026-01-01T00:00:00.000Z", from: { hash: address }, to: { hash: address } }], next_page_params: { block_number: 10, index: 2, items_count: 50 } }), { status: 200 }); } });
    const result = await client.transfers(address, "internal", 0n, 20n);
    expect(result.rows[0]?.uniqueId).toBe("0xhash:2");
    expect(result.pageKey).toBeTruthy();
    expect(calls).toBe(1);
  });
  it("maps provider rate limits to a typed error", async () => {
    const client = createRobinhoodProviderClient({ apiKey: "alchemy", blockscoutApiKey: "proapi_test", limiter, fetcher: async () => new Response("", { status: 429 }) });
    await expect(client.transfers(address, "internal", 0n, 20n)).rejects.toMatchObject({ code: "RATE_LIMITED" } satisfies Partial<RobinhoodProviderError>);
  });
});
