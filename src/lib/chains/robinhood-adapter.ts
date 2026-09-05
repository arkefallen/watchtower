import { asAddress, type Address, type ChainAdapter, type FetchOptions, type FetchResult, type PageMeta, type RawBalance, type RawInternalTx, type RawNativeTx, type RawTokenInfo, type RawTokenTransfer, type TokenHolderSummary } from "./types";
import type { AlchemyTransfer, RobinhoodProviderClient, TransferCategory } from "../robinhood/client";
import { rawValue } from "../robinhood/client";

export interface RobinhoodAdapterDeps { client: RobinhoodProviderClient; explorerBaseUrl?: string; pageCap?: number; }
const block = (row: AlchemyTransfer): bigint => BigInt(row.blockNum);
const date = (row: AlchemyTransfer): Date => new Date(row.metadata?.blockTimestamp ?? 0);
const to = (value: string | null | undefined): Address | null => value ? asAddress(value) : null;
async function collect<T>(client: RobinhoodProviderClient, address: Address, category: TransferCategory, opts: FetchOptions, map: (row: AlchemyTransfer, index: number) => T): Promise<FetchResult<T>> {
  const rows: T[] = []; const pages: PageMeta[] = []; let pageKey: string | undefined; let calls = 0;
  do {
    const page = await client.transfers(address, category, opts.fromBlock, opts.toBlock, pageKey, opts.signal); calls += 1;
    const selected = (opts.sort === "desc" ? [...page.rows].reverse() : page.rows).filter((row) => block(row) >= opts.fromBlock && (opts.toBlock === "latest" || block(row) <= opts.toBlock));
    for (const [index, row] of selected.entries()) { if (opts.maxRecords !== undefined && rows.length >= opts.maxRecords) break; rows.push(map(row, index)); }
    pages.push({ endpoint: category === "external" ? "NORMAL_TX" : category === "internal" ? "INTERNAL_TX" : "ERC20_TRANSFER", pageNumber: calls, recordsInPage: selected.length, pageWasFull: selected.length >= 1000, highestBlockSeen: selected.reduce((max, row) => block(row) > max ? block(row) : max, 0n), cumulativeRecords: rows.length });
    pageKey = page.pageKey;
  } while (pageKey && (opts.maxRecords === undefined || rows.length < opts.maxRecords));
  return { records: rows, coveredThroughBlock: opts.toBlock === "latest" ? pages.at(-1)?.highestBlockSeen ?? opts.fromBlock : opts.toBlock, truncated: Boolean(pageKey), pages, callsSpent: calls };
}
export function createRobinhoodChainAdapter(deps: RobinhoodAdapterDeps): ChainAdapter {
  const pageCap = deps.pageCap ?? 1000; void pageCap;
  const native = (row: AlchemyTransfer): RawNativeTx => ({ hash: row.hash, blockNumber: block(row), timestamp: date(row), from: asAddress(row.from), to: to(row.to), valueRaw: rawValue(row), gasUsed: null, gasPriceWei: null, isError: false, methodId: null, functionName: null, contractCreated: null });
  const internal = (row: AlchemyTransfer, index: number): RawInternalTx => ({ hash: row.hash, traceId: row.uniqueId ?? `${row.hash}:${index}`, blockNumber: block(row), timestamp: date(row), from: asAddress(row.from), to: to(row.to), valueRaw: rawValue(row), isError: false, callType: "internal" });
  const token = (row: AlchemyTransfer): RawTokenTransfer => ({ hash: row.hash, logIndex: Number(row.uniqueId?.split("-").at(-1) ?? 0), blockNumber: block(row), timestamp: date(row), from: asAddress(row.from), to: asAddress(row.to ?? row.from), tokenAddress: asAddress(row.rawContract?.address ?? "0x0000000000000000000000000000000000000000"), tokenSymbol: row.asset ?? null, tokenName: null, tokenDecimals: row.rawContract?.decimal ?? null, valueRaw: rawValue(row) });
  return {
    chain: "robinhood", chainId: 4663, nativeSymbol: "ETH", nativeDecimals: 18,
    getTransactions: (address, opts) => collect(deps.client, address, "external", opts, native),
    getInternalTxs: (address, opts) => collect(deps.client, address, "internal", opts, internal),
    getTokenTransfers: (address, opts) => collect(deps.client, address, "erc20", opts, token),
    async getTokenInfo(address): Promise<RawTokenInfo | null> { const metadata = await deps.client.tokenMetadata(address); return { address, symbol: metadata.symbol, name: metadata.name, decimals: metadata.decimals, deployedAt: null, deployerAddress: null, deployTxHash: null, totalSupplyRaw: null }; },
    async getBalances(address, tokenAddresses) { const nativeRaw = String(await deps.client.rpc("eth_getBalance", [address, "latest"])); const result: RawBalance[] = [{ tokenAddress: null, balanceRaw: nativeRaw, decimals: 18, symbol: "ETH" }]; for (const tokenAddress of tokenAddresses) { const value = await deps.client.rpc("alchemy_getTokenBalances", [address, [tokenAddress]]); result.push({ tokenAddress, balanceRaw: typeof value === "object" && value !== null && "tokenBalances" in value ? String((value as { tokenBalances: unknown[] }).tokenBalances[0] ?? "0") : "0", decimals: null, symbol: null }); } return result; },
    async getLatestBlock() { return BigInt(String(await deps.client.rpc("eth_blockNumber", []))); },
    async getBlockNumberByTimestamp(at) {
      const latest = BigInt(String(await deps.client.rpc("eth_blockNumber", [])));
      let low = 0n; let high = latest;
      while (low < high) {
        const mid = (low + high + 1n) / 2n;
        const value = await deps.client.rpc("eth_getBlockByNumber", [`0x${mid.toString(16)}`, false]);
        const timestamp = typeof value === "object" && value !== null && "timestamp" in value ? BigInt(String((value as { timestamp: unknown }).timestamp)) : 0n;
        if (timestamp <= BigInt(Math.floor(at.getTime() / 1000))) low = mid; else high = mid - 1n;
      }
      return low;
    },
    async getTokenHolderSummary(): Promise<TokenHolderSummary | null> { return null; },
    explorerTxUrl: (hash) => `${deps.explorerBaseUrl ?? "https://robinscan.io"}/tx/${hash}`,
    explorerAddressUrl: (address) => `${deps.explorerBaseUrl ?? "https://robinscan.io"}/address/${address}`,
  };
}
