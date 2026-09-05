import { describe, expect, it } from "vitest";
import { createRobinhoodChainAdapter } from "@/lib/chains/robinhood-adapter";
import { getAdapter } from "@/lib/chains/registry";
import type { Address } from "@/lib/chains/types";
import type { RobinhoodProviderClient } from "@/lib/robinhood/client";

const wallet = "0x0000000000000000000000000000000000000001" as Address;
const token = "0x0000000000000000000000000000000000000002" as Address;
function provider(): RobinhoodProviderClient {
  return {
    async transfers(_address, category, _from, _to, pageKey) {
      if (pageKey) return { rows: [] };
      const base = { blockNum: "0x10", hash: "0xabc", from: wallet, to: token, value: 1, asset: category === "erc20" ? "USDG" : "ETH", category, rawContract: { address: category === "erc20" ? token : null, value: "0x1", decimal: 18 }, metadata: { blockTimestamp: "2026-01-01T00:00:00.000Z" } };
      return { rows: category === "internal" ? [{ ...base, uniqueId: "0xabc:0" }, { ...base, uniqueId: "0xabc:1" }] : [base] };
    },
    async transaction() { return null; }, async receipt() { return null; },
    async tokenMetadata() { return { name: "USDG", symbol: "USDG", decimals: 18 }; },
    async rpc(method) { return method === "eth_blockNumber" ? "0x20" : "0x01"; },
  };
}

describe("RobinhoodChainAdapter", () => {
  it("uses chain 4663 and the official explorer host", () => {
    const adapter = createRobinhoodChainAdapter({ client: provider() });
    expect(adapter.chainId).toBe(4663);
    expect(adapter.explorerTxUrl("0xabc")).toContain("robinscan.io");
    expect(getAdapter("robinhood", { robinhood: () => adapter })).toBe(adapter);
  });
  it("preserves internal trace ordinals and maps UTC records", async () => {
    const result = await createRobinhoodChainAdapter({ client: provider() }).getInternalTxs(wallet, { fromBlock: 0n, toBlock: 20n });
    expect(result.records.map((row) => row.traceId)).toEqual(["0xabc:0", "0xabc:1"]);
    expect(result.records[0]?.timestamp.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
  it("returns empty pages without inventing records", async () => {
    const adapter = createRobinhoodChainAdapter({ client: { ...provider(), transfers: async () => ({ rows: [] }) } });
    expect((await adapter.getTokenTransfers(wallet, { fromBlock: 0n, toBlock: "latest" })).records).toEqual([]);
  });
  it("does not expose signing or transaction-send methods", () => {
    expect("sendTransaction" in createRobinhoodChainAdapter({ client: provider() })).toBe(false);
  });
  it("does not duplicate or lose rows across provider page boundaries", async () => {
    const first = { blockNum: "0x10", uniqueId: "0xpage:0", hash: "0xpage", from: wallet, to: token, value: 1, asset: "ETH", category: "internal", rawContract: { address: null, value: "0x1", decimal: 18 }, metadata: { blockTimestamp: "2026-01-01T00:00:00.000Z" } };
    const second = { ...first, uniqueId: "0xpage:1" };
    const client = provider();
    let page = 0;
    const paged: RobinhoodProviderClient = { ...client, async transfers(_address, category, _from, _to, pageKey) {
      if (category !== "internal") return { rows: [] };
      page += 1;
      return pageKey ? { rows: [second] } : { rows: [first], pageKey: "next" };
    } };
    const result = await createRobinhoodChainAdapter({ client: paged }).getInternalTxs(wallet, { fromBlock: 0n, toBlock: 20n });
    expect(result.records.map((row) => row.traceId)).toEqual(["0xpage:0", "0xpage:1"]);
    expect(result.records).toHaveLength(2);
    expect(result.callsSpent).toBe(2);
  });
});
