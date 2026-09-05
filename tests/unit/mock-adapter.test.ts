import { describe, expect, it } from "vitest";

import { createMockChainAdapter, loadScenario, type MockScenario } from "@/lib/chains/mock-adapter";
import type { RawNativeTx } from "@/lib/chains/types";

const wallet = "0x0000000000000000000000000000000000000001" as RawNativeTx["from"];
const tx = (blockNumber: bigint, hash: string): RawNativeTx => ({ hash, blockNumber, timestamp: new Date("2026-01-01T00:00:00Z"), from: wallet, to: null, valueRaw: "1", gasUsed: null, gasPriceWei: null, isError: false, methodId: null, functionName: null, contractCreated: null });

describe("MockChainAdapter", () => {
  it("loads every named scenario", async () => {
    for (const name of ["cex-funded-single", "cluster-of-three", "co-entry-24h", "internal-tx-funded", "dormant-wake", "hot-block-2500", "self-wallet-trades"]) {
      expect((await loadScenario(name)).name).toBe(name);
    }
  });

  it("filters, sorts, slices, and counts calls", async () => {
    const scenario: MockScenario = { name: "test", latestBlock: 3n, nativeTxs: { [wallet]: [tx(3n, "3"), tx(1n, "1"), tx(2n, "2")] }, internalTxs: {}, tokenTransfers: {}, tokens: {}, balances: {}, pageCap: 2 };
    const adapter = createMockChainAdapter("base", scenario);
    const result = await adapter.getTransactions(wallet, { fromBlock: 2n, toBlock: 3n, sort: "desc" });
    expect(result.records.map((item) => item.hash)).toEqual(["3", "2"]);
    expect(adapter.stats().getTransactions).toBe(1);
  });

  it("provides the deterministic 2,500-record hot-block fixture without network calls", async () => {
    const scenario = await loadScenario("hot-block-2500");
    const adapter = createMockChainAdapter("base", scenario);
    const result = await adapter.getTransactions(wallet, { fromBlock: 1000n, toBlock: 1000n });
    expect(result.records).toHaveLength(2500);
    expect(result.pages).toHaveLength(3);
    expect(adapter.stats().getTransactions).toBe(1);
  });

  it("keeps contract-mediated funding visible only in internal traces", async () => {
    const scenario = await loadScenario("internal-tx-funded");
    const adapter = createMockChainAdapter("base", scenario);
    expect((await adapter.getTransactions(wallet, { fromBlock: 0n, toBlock: 100n })).records).toHaveLength(0);
    const internal = await adapter.getInternalTxs(wallet, { fromBlock: 0n, toBlock: 100n });
    expect(internal.records).toHaveLength(1);
    expect(internal.records[0]?.traceId).toContain("_0");
  });
});
