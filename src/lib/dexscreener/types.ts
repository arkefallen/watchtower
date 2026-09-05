export interface DexTokenPrice {
  address: string;
  priceUsd: string | null;
  marketCap: number | null;
  liquidityUsd: number | null;
  fdv: number | null;
  pairCreatedAt: Date | null;
  pairAddress: string | null;
}

export interface DexScreenerClient {
  prices(addresses: string[]): Promise<Map<string, DexTokenPrice>>;
}
