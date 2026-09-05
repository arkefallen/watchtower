export type ChainSlug = "base" | "bsc" | "robinhood";
export type Address = string & { readonly __brand: "Address" };
export type RawAmount = string;

export interface RawNativeTx { hash: string; blockNumber: bigint; timestamp: Date; from: Address; to: Address | null; valueRaw: RawAmount; gasUsed: RawAmount | null; gasPriceWei: RawAmount | null; isError: boolean; methodId: string | null; functionName: string | null; contractCreated: Address | null; }
export interface RawInternalTx { hash: string; traceId: string; blockNumber: bigint; timestamp: Date; from: Address; to: Address | null; valueRaw: RawAmount; isError: boolean; callType: string | null; }
export interface RawTokenTransfer { hash: string; logIndex: number; blockNumber: bigint; timestamp: Date; from: Address; to: Address; tokenAddress: Address; tokenSymbol: string | null; tokenName: string | null; tokenDecimals: number | null; valueRaw: RawAmount; }
export interface RawTokenInfo { address: Address; symbol: string | null; name: string | null; decimals: number | null; deployedAt: Date | null; deployerAddress: Address | null; deployTxHash: string | null; totalSupplyRaw: RawAmount | null; }
export interface RawBalance { tokenAddress: Address | null; balanceRaw: RawAmount; decimals: number | null; symbol: string | null; }
export interface PageMeta { endpoint: "NORMAL_TX" | "INTERNAL_TX" | "ERC20_TRANSFER"; pageNumber: number; recordsInPage: number; pageWasFull: boolean; highestBlockSeen: bigint; cumulativeRecords: number; }
export interface BlockRange { fromBlock: bigint; toBlock: bigint | "latest"; }
export interface FetchOptions extends BlockRange { maxRecords?: number; sort?: "asc" | "desc"; signal?: AbortSignal; onPage?: (page: PageMeta) => void | Promise<void>; }
export interface FetchResult<T> { records: T[]; coveredThroughBlock: bigint; truncated: boolean; pages: PageMeta[]; callsSpent: number; }
export interface TokenHolderSummary { holderCount: number | null; top10SharePct: number | null; topHolders: Array<{ address: Address; shareRaw: RawAmount; sharePct: number | null }>; source: "ETHERSCAN" | "ROBINHOOD_PROVIDER" | "UNAVAILABLE"; }
export interface ChainAdapter {
  readonly chain: ChainSlug; readonly chainId: number; readonly nativeSymbol: string; readonly nativeDecimals: number;
  getTransactions(address: Address, opts: FetchOptions): Promise<FetchResult<RawNativeTx>>;
  getInternalTxs(address: Address, opts: FetchOptions): Promise<FetchResult<RawInternalTx>>;
  getTokenTransfers(address: Address, opts: FetchOptions): Promise<FetchResult<RawTokenTransfer>>;
  getTokenInfo(tokenAddress: Address): Promise<RawTokenInfo | null>;
  getBalances(address: Address, tokenAddresses: Address[]): Promise<RawBalance[]>;
  getLatestBlock(): Promise<bigint>;
  getBlockNumberByTimestamp(at: Date): Promise<bigint>;
  getTokenHolderSummary(tokenAddress: Address): Promise<TokenHolderSummary | null>;
  explorerTxUrl(hash: string): string;
  explorerAddressUrl(address: Address): string;
}

export class ProviderNotConfiguredError extends Error {
  constructor(chain: ChainSlug) { super(`Provider is not configured for chain: ${chain}`); this.name = "ProviderNotConfiguredError"; }
}

export function asAddress(value: string): Address {
  const normalized = value.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(normalized)) throw new Error(`Invalid address: ${value}`);
  return normalized as Address;
}
