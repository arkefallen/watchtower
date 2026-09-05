import { describe, expect, it } from "vitest";

import { createMockChainAdapter } from "@/lib/chains/mock-adapter";
import { CHAIN_REGISTRY, getAdapter } from "@/lib/chains/registry";

function emptyAdapter(chain: "base" | "bsc" | "robinhood") {
  return createMockChainAdapter(chain, { name: "registry", latestBlock: 0n, nativeTxs: {}, internalTxs: {}, tokenTransfers: {}, tokens: {}, balances: {} });
}

describe("chain adapter registry", () => {
  it("constructs Base and BSC only through explicit factories", () => {
    const base = emptyAdapter("base");
    const bsc = emptyAdapter("bsc");
    expect(getAdapter("base", { base: () => base }).chainId).toBe(8453);
    expect(getAdapter("bsc", { bsc: () => bsc }).chainId).toBe(56);
  });

  it("keeps all three chain metadata entries stable", () => {
    expect(CHAIN_REGISTRY).toMatchObject({
      base: { chainId: 8453, nativeSymbol: "ETH" },
      bsc: { chainId: 56, nativeSymbol: "BNB" },
      robinhood: { chainId: 4663, nativeSymbol: "ETH" },
    });
  });

  it("fails explicitly when no factory is configured", () => {
    expect(() => getAdapter("robinhood")).toThrow("Provider is not configured for chain: robinhood");
  });
});
