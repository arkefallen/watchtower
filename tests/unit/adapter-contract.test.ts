import { describe, expect, it } from "vitest";

import { createMockChainAdapter, type MockScenario } from "@/lib/chains/mock-adapter";
import { createRobinhoodChainAdapter } from "@/lib/chains/robinhood-adapter";
import type { Address, ChainAdapter, RawNativeTx, RawTokenTransfer, RawInternalTx } from "@/lib/chains/types";
import type { AlchemyTransfer, RobinhoodProviderClient } from "@/lib/robinhood/client";

const wallet = "0x0000000000000000000000000000000000000001" as Address;
const counterparty = "0x0000000000000000000000000000000000000002" as Address;
const token = "0x0000000000000000000000000000000000000003" as Address;
const range = { fromBlock: 0n, toBlock: "latest" as const };

const nativeTx: RawNativeTx = {
  hash: "0xnative", blockNumber: 10n, timestamp: new Date("2026-01-01T00:00:00Z"),
  from: wallet, to: counterparty, valueRaw: "100", gasUsed: "1", gasPriceWei: "2",
  isError: false, methodId: null, functionName: null, contractCreated: null,
};
const internalTx: RawInternalTx = {
  hash: "0xinternal", traceId: "0xinternal:0", blockNumber: 11n,
  timestamp: new Date("2026-01-01T00:00:01Z"), from: counterparty, to: wallet,
  valueRaw: "50", isError: false, callType: "call",
};
const transfer: RawTokenTransfer = {
  hash: "0xtoken", logIndex: 0, blockNumber: 12n, timestamp: new Date("2026-01-01T00:00:02Z"),
  from: counterparty, to: wallet, tokenAddress: token, tokenSymbol: "TST", tokenName: "Test",
  tokenDecimals: 18, valueRaw: "25",
};

function mockAdapter(): ChainAdapter {
  const scenario: MockScenario = {
    name: "contract", latestBlock: 20n,
    nativeTxs: { [wallet]: [nativeTx] }, internalTxs: { [wallet]: [internalTx] },
    tokenTransfers: { [wallet]: [transfer] },
    tokens: { [token]: { address: token, symbol: "TST", name: "Test", decimals: 18, deployedAt: null, deployerAddress: null, deployTxHash: null, totalSupplyRaw: "1000" } },
    balances: { [wallet]: [{ tokenAddress: null, balanceRaw: "100", decimals: 18, symbol: "ETH" }] },
  };
  return createMockChainAdapter("base", scenario);
}

function provider(): RobinhoodProviderClient {
  const row = (category: string): AlchemyTransfer => ({
    blockNum: category === "external" ? "0xa" : category === "internal" ? "0xb" : "0xc",
    uniqueId: category === "erc20" ? "0xtoken-0" : `0x${category}:0`, hash: `0x${category}`,
    from: wallet, to: counterparty, value: 1, asset: category === "erc20" ? "TST" : "ETH", category,
    rawContract: { address: category === "erc20" ? token : null, value: "0x19", decimal: 18 },
    metadata: { blockTimestamp: "2026-01-01T00:00:00.000Z" },
  });
  return {
    async transfers(_address, category) { return { rows: [row(category)] }; },
    async transaction() { return null; }, async receipt() { return null; },
    async tokenMetadata() { return { name: "Test", symbol: "TST", decimals: 18 }; },
    async rpc(method) {
      if (method === "eth_blockNumber") return "0x14";
      if (method === "eth_getBlockByNumber") return { timestamp: "0x65a9ec80" };
      if (method === "eth_getBalance") return "0x64";
      if (method === "alchemy_getTokenBalances") return { tokenBalances: ["0x19"] };
      return null;
    },
  };
}

async function assertReadOnlyContract(adapter: ChainAdapter): Promise<void> {
  expect(adapter.chainId).toBeGreaterThan(0);
  expect(await adapter.getTransactions(wallet, range)).toHaveProperty("records");
  expect(await adapter.getInternalTxs(wallet, range)).toHaveProperty("records");
  expect(await adapter.getTokenTransfers(wallet, range)).toHaveProperty("records");
  expect(await adapter.getTokenInfo(token)).not.toBeNull();
  expect(await adapter.getBalances(wallet, [token])).not.toHaveLength(0);
  expect(await adapter.getLatestBlock()).toBeGreaterThan(0n);
  expect(await adapter.getBlockNumberByTimestamp(new Date("2026-01-01T00:00:00Z"))).toBeGreaterThanOrEqual(0n);
  expect(await adapter.getTokenHolderSummary(token)).toBeNull();
  expect(adapter.explorerTxUrl("0xhash")).toContain("0xhash");
  expect(adapter.explorerAddressUrl(wallet)).toContain(wallet);
}

describe("ChainAdapter shared read-only contract", () => {
  it("is satisfied by the deterministic mock adapter", async () => {
    await assertReadOnlyContract(mockAdapter());
  });

  it("is satisfied by the Robinhood adapter", async () => {
    await assertReadOnlyContract(createRobinhoodChainAdapter({ client: provider() }));
  });
});
