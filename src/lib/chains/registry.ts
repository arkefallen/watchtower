import type { ChainSlug } from "./types";
import { ProviderNotConfiguredError, type ChainAdapter } from "./types";

export interface ChainMetadata { slug: ChainSlug; chainId: number; nativeSymbol: string; nativeDecimals: number; explorerBaseUrl: string; }
export const CHAIN_REGISTRY: Record<ChainSlug, ChainMetadata> = {
  base: { slug: "base", chainId: 8453, nativeSymbol: "ETH", nativeDecimals: 18, explorerBaseUrl: "https://basescan.org" },
  bsc: { slug: "bsc", chainId: 56, nativeSymbol: "BNB", nativeDecimals: 18, explorerBaseUrl: "https://bscscan.com" },
  robinhood: { slug: "robinhood", chainId: 4663, nativeSymbol: "ETH", nativeDecimals: 18, explorerBaseUrl: "https://robinscan.io" },
};

export function getChainMetadata(chain: ChainSlug): ChainMetadata { return CHAIN_REGISTRY[chain]; }

export interface ChainAdapterFactories {
  base?: () => ChainAdapter;
  bsc?: () => ChainAdapter;
  robinhood?: () => ChainAdapter;
}

export function getAdapter(chain: ChainSlug, factories: ChainAdapterFactories = {}): ChainAdapter {
  const adapter = factories[chain]?.();
  if (adapter) return adapter;
  throw new ProviderNotConfiguredError(chain);
}
